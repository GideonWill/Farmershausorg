from django.urls import path

from apps.orders.views import (
    CheckoutView,
    FulfillmentSlotListView,
    OrderCancelView,
    OrderCollectionView,
    OrderDetailView,
    OrderReceiptView,
    OrderTrackingView,
    StaffOrderCollectionView,
    StaffOrderStatusView,
    StaffPaidOrderStreamView,
    StaffOrderRiderView,
    StaffOrderLineAdjustmentView,
)


urlpatterns = [
    path("fulfillment-slots/", FulfillmentSlotListView.as_view(), name="fulfillment-slots"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("orders/", OrderCollectionView.as_view(), name="orders"),
    path("orders/<str:order_number>/", OrderDetailView.as_view(), name="order-detail"),
    path("orders/<str:order_number>/tracking/", OrderTrackingView.as_view(), name="order-tracking"),
    path("orders/<str:order_number>/receipt.pdf", OrderReceiptView.as_view(), name="order-receipt"),
    path("orders/<str:order_number>/cancel/", OrderCancelView.as_view(), name="order-cancel"),
    path("staff/orders/", StaffOrderCollectionView.as_view(), name="staff-orders"),
    path("staff/orders/paid-stream/", StaffPaidOrderStreamView.as_view(), name="staff-paid-order-stream"),
    path("staff/orders/<str:order_number>/status/", StaffOrderStatusView.as_view(), name="staff-order-status"),
    path("staff/orders/<str:order_number>/rider/", StaffOrderRiderView.as_view(), name="staff-order-rider"),
    path("staff/orders/<str:order_number>/items/adjust/", StaffOrderLineAdjustmentView.as_view(), name="staff-order-item-adjust"),
]
