from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.branches.views import BranchDeliveryZoneListView, NearestBranchView, PublicBranchViewSet


router = SimpleRouter()
router.register("", PublicBranchViewSet, basename="branch")

urlpatterns = [
    path("nearest/", NearestBranchView.as_view(), name="nearest-branch"),
    path("<slug:branch_slug>/delivery-zones/", BranchDeliveryZoneListView.as_view(), name="branch-delivery-zones"),
    path("", include(router.urls)),
]
