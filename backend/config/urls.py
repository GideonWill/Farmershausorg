from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.branches.views import StaffBranchListView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/branches/", include("apps.branches.urls")),
    path("api/v1/", include("apps.catalogue.urls")),
    path("api/v1/", include("apps.baskets.urls")),
    path("api/v1/", include("apps.content.urls")),
    path("api/v1/", include("apps.cart.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/", include("apps.vouchers.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.reports.urls")),
    path("api/v1/staff/branches/", StaffBranchListView.as_view(), name="staff-branches"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
