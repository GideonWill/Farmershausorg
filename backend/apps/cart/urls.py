from django.urls import path

from apps.cart.views import CartItemCollectionView, CartItemDetailView, CartValidationView, CartView


urlpatterns = [
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemCollectionView.as_view(), name="cart-items"),
    path("cart/items/<uuid:item_id>/", CartItemDetailView.as_view(), name="cart-item"),
    path("cart/validate/", CartValidationView.as_view(), name="cart-validate"),
]
