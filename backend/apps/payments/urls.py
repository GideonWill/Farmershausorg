from django.urls import path

from apps.payments.views import (
    BranchDailyReconciliationView,
    HubtelWebhookView,
    PaymentInitiationView,
    PaymentSimulateSuccessView,
    PaymentStatusView,
    RefundRetryView,
    StaffRefundReviewView,
)


urlpatterns = [
    path("orders/<str:order_number>/initiate/", PaymentInitiationView.as_view(), name="payment-initiate"),
    path("orders/<str:order_number>/retry/", PaymentInitiationView.as_view(), name="payment-retry"),
    path("orders/<str:order_number>/status/", PaymentStatusView.as_view(), name="payment-status"),
    path("orders/<str:order_number>/simulate-success/", PaymentSimulateSuccessView.as_view(), name="payment-simulate-success"),
    path("webhooks/hubtel/", HubtelWebhookView.as_view(), name="hubtel-webhook"),
    path("reconciliation/daily/", BranchDailyReconciliationView.as_view(), name="branch-daily-reconciliation"),
    path("refunds/<uuid:refund_id>/retry/", RefundRetryView.as_view(), name="refund-retry"),
    path("staff/refunds/", StaffRefundReviewView.as_view(), name="staff-refund-review"),
    path("staff/refunds/<str:order_number>/approve-adjustment/", StaffRefundReviewView.as_view(), name="staff-adjustment-refund"),
]
