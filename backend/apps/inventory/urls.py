from django.urls import path

from apps.inventory.views import (
    StaffInventoryAdjustmentView,
    StaffInventoryListView,
    StaffInventoryExportView,
    StaffInventoryImportView,
    StaffProductInventoryView,
)


urlpatterns = [
    path(
        "branches/<uuid:branch_id>/inventory/",
        StaffInventoryListView.as_view(),
        name="staff-branch-inventory",
    ),
    path(
        "branches/<uuid:branch_id>/inventory/export.csv",
        StaffInventoryExportView.as_view(),
        name="staff-branch-inventory-export",
    ),
    path(
        "branches/<uuid:branch_id>/inventory/import.csv",
        StaffInventoryImportView.as_view(),
        name="staff-branch-inventory-import",
    ),
    path(
        "branches/<uuid:branch_id>/inventory/adjustments/",
        StaffInventoryAdjustmentView.as_view(),
        name="staff-inventory-adjustment",
    ),
    path(
        "branches/<uuid:branch_id>/inventory/<uuid:product_id>/",
        StaffProductInventoryView.as_view(),
        name="staff-product-inventory",
    ),
]
