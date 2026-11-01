from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.catalogue.views import (
    ProductSearchSuggestionsView,
    PublicCategoryViewSet,
    PublicProductViewSet,
)


router = SimpleRouter()
router.register("categories", PublicCategoryViewSet, basename="category")
router.register("products", PublicProductViewSet, basename="product")

urlpatterns = [
    path("search/suggestions/", ProductSearchSuggestionsView.as_view(), name="product-search-suggestions"),
    path("", include(router.urls)),
]
