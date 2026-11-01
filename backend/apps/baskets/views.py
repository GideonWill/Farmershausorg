from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.baskets.models import BasketCategory, BasketComponent, BasketPackage
from apps.baskets.serializers import BasketCategorySerializer, BasketPackageSerializer
from apps.branches.api import validate_active_branch_id
from apps.inventory.models import ProductBranch


class PublicBasketPackageViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AllowAny,)
    serializer_class = BasketPackageSerializer
    queryset = BasketPackage.objects.none()
    lookup_field = "slug"

    def get_queryset(self):
        branch_id = self.request.query_params.get("branch")
        if not branch_id:
            raise ValidationError({"branch": "Select a branch to view basket availability."})
        branch_id = validate_active_branch_id(branch_id)

        branch_inventory = ProductBranch.objects.filter(branch_id=branch_id)
        components = BasketComponent.objects.select_related("product").prefetch_related(
            Prefetch(
                "product__branch_inventory",
                queryset=branch_inventory,
                to_attr="selected_branch_inventory",
            )
        )
        return (
            BasketPackage.objects.filter(is_active=True)
            .prefetch_related(Prefetch("components", queryset=components))
            .order_by("name")
        )


class PublicBasketCategoryListView(viewsets.ViewSet):
    permission_classes = (AllowAny,)

    @extend_schema(responses=BasketCategorySerializer(many=True))
    def list(self, request):
        categories = BasketCategory.objects.filter(is_active=True).order_by("display_order", "name")
        return Response(BasketCategorySerializer(categories, many=True).data)
