from django.urls import path

from apps.vouchers.views import BulkVoucherCreateView, VoucherValidationView


urlpatterns = [
    path("vouchers/validate/", VoucherValidationView.as_view(), name="voucher-validate"),
    path("vouchers/bulk/", BulkVoucherCreateView.as_view(), name="voucher-bulk-create"),
]
