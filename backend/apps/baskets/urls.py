from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.baskets.views import PublicBasketCategoryListView, PublicBasketPackageViewSet


router = SimpleRouter()
router.register("basket-packages", PublicBasketPackageViewSet, basename="basket-package")
router.register("basket-categories", PublicBasketCategoryListView, basename="basket-category")

urlpatterns = [path("", include(router.urls))]
