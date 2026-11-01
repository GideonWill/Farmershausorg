import csv
import io
import uuid

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.audit.models import AuditEvent
from apps.common.permissions import HasBranchMembership
from apps.inventory.models import InventoryAdjustment, ProductBranch
from apps.inventory.serializers import (
    InventoryAdjustmentRequestSerializer,
    InventoryAdjustmentSerializer,
    ProductBranchSerializer,
    ProductBranchUpdateSerializer,
)


class InventoryRequestConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The idempotency key was already used for a different adjustment."
    default_code = "idempotency_conflict"


class StaffInventoryListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated, HasBranchMembership)
    serializer_class = ProductBranchSerializer

    def get_queryset(self):
        return (
            ProductBranch.objects.filter(branch_id=self.kwargs["branch_id"])
            .select_related("branch", "product")
            .order_by("product__name")
        )


class StaffInventoryExportView(APIView):
    permission_classes = (IsAuthenticated, HasBranchMembership)

    def get(self, request, branch_id):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="farmershaus-inventory-{branch_id}.csv"'
        writer = csv.writer(response)
        writer.writerow((
            "product_id", "sku", "product_name", "stock_on_hand",
            "is_available", "price_override_minor",
        ))
        for inventory in ProductBranch.objects.filter(branch_id=branch_id).select_related(
            "product"
        ).order_by("product__name"):
            writer.writerow((
                inventory.product_id,
                inventory.product.sku,
                inventory.product.name,
                inventory.stock_on_hand,
                str(inventory.is_available).lower(),
                "" if inventory.price_override_minor is None else inventory.price_override_minor,
            ))
        return response


class StaffInventoryImportView(APIView):
    permission_classes = (IsAuthenticated, HasBranchMembership)

    def post(self, request, branch_id):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"file": ["Upload a CSV file."]}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded.size > 2 * 1024 * 1024:
            return Response({"file": ["CSV file must be 2 MB or smaller."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            decoded = uploaded.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(decoded))
            required = {"product_id", "stock_on_hand", "is_available", "price_override_minor"}
            if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
                raise ValueError("CSV headers must include product_id, stock_on_hand, is_available, and price_override_minor.")
            rows = list(reader)
            if not rows or len(rows) > 500:
                raise ValueError("CSV must contain between 1 and 500 inventory rows.")
            parsed_rows = []
            seen = set()
            for line_number, row in enumerate(rows, start=2):
                product_id = uuid.UUID(row["product_id"])
                if product_id in seen:
                    raise ValueError(f"Line {line_number}: duplicate product_id.")
                seen.add(product_id)
                quantity = int(row["stock_on_hand"])
                if quantity < 0:
                    raise ValueError(f"Line {line_number}: stock_on_hand cannot be negative.")
                availability = row["is_available"].strip().lower()
                if availability not in {"true", "false", "1", "0", "yes", "no"}:
                    raise ValueError(f"Line {line_number}: is_available must be true or false.")
                raw_price = row["price_override_minor"].strip()
                price = int(raw_price) if raw_price else None
                if price is not None and price < 0:
                    raise ValueError(f"Line {line_number}: price_override_minor cannot be negative.")
                parsed_rows.append((product_id, quantity, availability in {"true", "1", "yes"}, price))
        except (UnicodeDecodeError, csv.Error, KeyError, TypeError, ValueError) as error:
            return Response({"file": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        with transaction.atomic():
            inventory_by_product = {
                row.product_id: row
                for row in ProductBranch.objects.select_for_update()
                .filter(branch_id=branch_id, product_id__in=seen)
                .select_related("branch", "product")
            }
            if len(inventory_by_product) != len(parsed_rows):
                return Response(
                    {"file": ["Every product_id must already have inventory at your assigned branch."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            for product_id, quantity, _, _ in parsed_rows:
                inventory = inventory_by_product[product_id]
                if quantity < inventory.reserved_quantity:
                    return Response(
                        {"file": [f"{inventory.product.name}: stock cannot be below reserved quantity."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            for product_id, quantity, available, price in parsed_rows:
                inventory = inventory_by_product[product_id]
                before = {
                    "stock_on_hand": inventory.stock_on_hand,
                    "is_available": inventory.is_available,
                    "price_override_minor": inventory.price_override_minor,
                }
                delta = quantity - inventory.stock_on_hand
                if delta:
                    InventoryAdjustment.objects.create(
                        product_branch=inventory,
                        actor=request.user,
                        idempotency_key=f"csv-import-{uuid.uuid4()}",
                        quantity_delta=delta,
                        reason="Bulk CSV inventory import",
                        stock_before=inventory.stock_on_hand,
                        stock_after=quantity,
                    )
                inventory.stock_on_hand = quantity
                inventory.is_available = available
                inventory.price_override_minor = price
                inventory.save(update_fields=(
                    "stock_on_hand", "is_available", "price_override_minor", "updated_at",
                ))
                AuditEvent.objects.create(
                    actor=request.user,
                    branch=inventory.branch,
                    action="inventory.csv_imported",
                    resource_type="ProductBranch",
                    resource_id=str(inventory.pk),
                    before_data=before,
                    after_data={
                        "stock_on_hand": quantity,
                        "is_available": available,
                        "price_override_minor": price,
                    },
                )
                updated_count += 1
        return Response({"updated_count": updated_count})


class StaffProductInventoryView(APIView):
    permission_classes = (IsAuthenticated, HasBranchMembership)

    def get_object(self):
        return get_object_or_404(
            ProductBranch.objects.select_related("branch", "product"),
            branch_id=self.kwargs["branch_id"],
            product_id=self.kwargs["product_id"],
        )

    @extend_schema(responses=ProductBranchSerializer)
    def get(self, request, *args, **kwargs):
        return Response(ProductBranchSerializer(self.get_object()).data)

    @extend_schema(
        request=ProductBranchUpdateSerializer,
        responses=ProductBranchSerializer,
    )
    def patch(self, request, *args, **kwargs):
        with transaction.atomic():
            inventory = get_object_or_404(
                ProductBranch.objects.select_for_update().select_related("branch", "product"),
                branch_id=self.kwargs["branch_id"],
                product_id=self.kwargs["product_id"],
            )
            serializer = ProductBranchUpdateSerializer(
                inventory,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            reason = serializer.validated_data["reason"]
            before = {
                "is_available": inventory.is_available,
                "price_override_minor": inventory.price_override_minor,
            }
            inventory = serializer.save()
            AuditEvent.objects.create(
                actor=request.user,
                branch=inventory.branch,
                action="inventory.settings_updated",
                resource_type="ProductBranch",
                resource_id=str(inventory.pk),
                before_data=before,
                after_data={
                    "is_available": inventory.is_available,
                    "price_override_minor": inventory.price_override_minor,
                    "reason": reason,
                },
            )
        return Response(ProductBranchSerializer(inventory).data)


class StaffInventoryAdjustmentView(APIView):
    permission_classes = (IsAuthenticated, HasBranchMembership)

    @extend_schema(
        request=InventoryAdjustmentRequestSerializer,
        responses={200: InventoryAdjustmentSerializer, 201: InventoryAdjustmentSerializer},
    )
    def post(self, request, *args, **kwargs):
        request_serializer = InventoryAdjustmentRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        idempotency_key = request.headers.get("Idempotency-Key", "").strip()
        if not idempotency_key or len(idempotency_key) > 100:
            return Response(
                {"Idempotency-Key": ["A key of 1–100 characters is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product_id = request_serializer.validated_data["product_id"]
        quantity_delta = request_serializer.validated_data["quantity_delta"]
        reason = request_serializer.validated_data["reason"]

        try:
            with transaction.atomic():
                existing = InventoryAdjustment.objects.filter(
                    idempotency_key=idempotency_key
                ).select_related("product_branch").first()
                if existing:
                    self.ensure_matching_request(
                        existing,
                        request,
                        kwargs["branch_id"],
                        product_id,
                        quantity_delta,
                        reason,
                    )
                    return Response(
                        InventoryAdjustmentSerializer(existing).data,
                        status=status.HTTP_200_OK,
                    )

                inventory = get_object_or_404(
                    ProductBranch.objects.select_for_update().select_related("branch", "product"),
                    branch_id=kwargs["branch_id"],
                    product_id=product_id,
                )
                stock_before = inventory.stock_on_hand
                stock_after = stock_before + quantity_delta
                if stock_after < inventory.reserved_quantity:
                    return Response(
                        {"quantity_delta": ["Stock cannot be reduced below the reserved quantity."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                inventory.stock_on_hand = stock_after
                inventory.full_clean()
                inventory.save(update_fields=("stock_on_hand", "updated_at"))
                adjustment = InventoryAdjustment.objects.create(
                    product_branch=inventory,
                    actor=request.user,
                    idempotency_key=idempotency_key,
                    quantity_delta=quantity_delta,
                    reason=reason,
                    stock_before=stock_before,
                    stock_after=stock_after,
                )
                AuditEvent.objects.create(
                    actor=request.user,
                    branch=inventory.branch,
                    action="inventory.stock_adjusted",
                    resource_type="InventoryAdjustment",
                    resource_id=str(adjustment.pk),
                    request_id=idempotency_key,
                    before_data={"stock_on_hand": stock_before},
                    after_data={
                        "stock_on_hand": stock_after,
                        "quantity_delta": quantity_delta,
                        "reason": reason,
                    },
                )
        except IntegrityError:
            existing = InventoryAdjustment.objects.filter(
                idempotency_key=idempotency_key
            ).select_related("product_branch").first()
            if existing is None:
                raise
            self.ensure_matching_request(
                existing,
                request,
                kwargs["branch_id"],
                product_id,
                quantity_delta,
                reason,
            )
            return Response(
                InventoryAdjustmentSerializer(existing).data,
                status=status.HTTP_200_OK,
            )

        return Response(
            InventoryAdjustmentSerializer(adjustment).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def ensure_matching_request(
        existing,
        request,
        branch_id,
        product_id,
        quantity_delta,
        reason,
    ):
        is_same_request = (
            existing.actor_id == request.user.pk
            and str(existing.product_branch.branch_id) == str(branch_id)
            and str(existing.product_branch.product_id) == str(product_id)
            and existing.quantity_delta == quantity_delta
            and existing.reason == reason
        )
        if not is_same_request:
            raise InventoryRequestConflict()
