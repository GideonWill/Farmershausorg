from django.db.models import F, OuterRef, Prefetch, Subquery
from django.db.models.functions import Coalesce
from rest_framework import filters, serializers, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.branches.api import validate_active_branch_id
from apps.catalogue.models import Category, Product
from apps.catalogue.pagination import ProductPagination
from apps.catalogue.serializers import CategorySerializer, ProductSerializer
from apps.inventory.models import ProductBranch


class ProductQuerySerializer(serializers.Serializer):
    branch = serializers.UUIDField()
    category = serializers.SlugField(required=False)
    tag = serializers.CharField(required=False)
    organic = serializers.BooleanField(required=False)
    in_season = serializers.BooleanField(required=False)
    min_price = serializers.IntegerField(required=False, min_value=0)
    max_price = serializers.IntegerField(required=False, min_value=0)
    ordering = serializers.ChoiceField(
        choices=("name", "-name", "price", "-price", "created_at", "-created_at"),
        required=False,
    )

    def validate(self, attrs):
        if (
            "min_price" in attrs
            and "max_price" in attrs
            and attrs["min_price"] > attrs["max_price"]
        ):
            raise serializers.ValidationError(
                {"max_price": "Maximum price must be greater than or equal to minimum price."}
            )
        return attrs


def product_queryset_for_branch(branch_id):
    selected_inventory = ProductBranch.objects.filter(branch_id=branch_id)
    all_inventory = ProductBranch.objects.select_related("branch")
    price_override = Subquery(
        selected_inventory.filter(product_id=OuterRef("pk")).values("price_override_minor")[:1]
    )
    return (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .annotate(branch_price=Coalesce(price_override, F("base_price_minor")))
        .prefetch_related(
            Prefetch(
                "branch_inventory",
                queryset=selected_inventory,
                to_attr="selected_branch_inventory",
            ),
            Prefetch(
                "branch_inventory",
                queryset=all_inventory,
                to_attr="all_branch_inventory",
            ),
            "tags",
        )
    )


class PublicCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AllowAny,)
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_active=True)
    lookup_field = "slug"


class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AllowAny,)
    serializer_class = ProductSerializer
    queryset = Product.objects.none()
    lookup_field = "slug"
    pagination_class = ProductPagination
    filter_backends = (filters.SearchFilter,)
    search_fields = ("name", "description", "sku", "category__name", "origin")

    def get_queryset(self):
        query = ProductQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        branch_id = validate_active_branch_id(query.validated_data["branch"])
        self.selected_branch_id = branch_id
        params = query.validated_data
        products = product_queryset_for_branch(branch_id)
        if "category" in params:
            products = products.filter(category__slug=params["category"])
        if "tag" in params:
            tags = [slug.strip() for slug in params["tag"].split(",") if slug.strip()]
            if tags:
                products = products.filter(tags__slug__in=tags).distinct()
        if params.get("organic") is True:
            products = products.filter(tags__slug="organic")
        elif params.get("organic") is False:
            products = products.exclude(tags__slug="organic")
        if params.get("in_season") is True:
            products = products.filter(tags__slug="in-season")
        elif params.get("in_season") is False:
            products = products.exclude(tags__slug="in-season")
        if "min_price" in params:
            products = products.filter(branch_price__gte=params["min_price"])
        if "max_price" in params:
            products = products.filter(branch_price__lte=params["max_price"])
        if "ordering" in params:
            order = params["ordering"]
            products = products.order_by(
                ("-" if order.startswith("-") else "")
                + ("branch_price" if order.lstrip("-") == "price" else order.lstrip("-"))
            )
        return products

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if hasattr(self, "selected_branch_id"):
            context["selected_branch_id"] = self.selected_branch_id
        return context


class SearchSuggestionQuerySerializer(serializers.Serializer):
    branch = serializers.UUIDField()
    q = serializers.CharField(min_length=2, max_length=100)


class ProductSearchSuggestionsResponseSerializer(serializers.Serializer):
    results = ProductSerializer(many=True)


class ProductSearchSuggestionsView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        parameters=[
            OpenApiParameter("branch", OpenApiTypes.UUID, required=True),
            OpenApiParameter("q", OpenApiTypes.STR, required=True),
        ],
        responses=ProductSearchSuggestionsResponseSerializer,
    )
    def get(self, request):
        query = SearchSuggestionQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        branch_id = validate_active_branch_id(query.validated_data["branch"])
        products = (
            product_queryset_for_branch(branch_id)
            .filter(name__icontains=query.validated_data["q"])
            .order_by("name")[:8]
        )
        serialized = ProductSerializer(
            products,
            many=True,
            context={"request": request, "selected_branch_id": branch_id},
        )
        return Response({"results": serialized.data})
