from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import BranchMembership, User
from apps.audit.models import AuditEvent
from apps.branches.models import Branch
from apps.catalogue.models import Category, Product
from apps.inventory.models import InventoryAdjustment, ProductBranch


class StaffInventoryApiTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        self.other_branch = Branch.objects.get(slug="east-legon")
        category = Category.objects.create(slug="herbs", name="Herbs")
        self.product = Product.objects.create(
            sku="MINT-001",
            slug="mint",
            category=category,
            name="Mint",
            unit="bunch",
            base_price_minor=500,
        )
        self.inventory = ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=10,
            reserved_quantity=3,
        )
        self.staff = User.objects.create_user(username="dome-staff", password="Random-Password-93!")
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        self.client.force_authenticate(user=self.staff)

    def test_staff_cannot_read_another_branch_inventory(self):
        response = self.client.get(
            f"/api/v1/branches/{self.other_branch.pk}/inventory/"
        )

        self.assertEqual(response.status_code, 403)

    def test_adjustment_updates_stock_once_and_replays_idempotently(self):
        url = f"/api/v1/branches/{self.branch.pk}/inventory/adjustments/"
        payload = {
            "product_id": str(self.product.pk),
            "quantity_delta": 4,
            "reason": "Received delivery",
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "mint-delivery-2026-001"}

        first = self.client.post(url, payload, format="json", **headers)
        replay = self.client.post(url, payload, format="json", **headers)

        self.inventory.refresh_from_db()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(first.data["id"], replay.data["id"])
        self.assertEqual(self.inventory.stock_on_hand, 14)
        self.assertEqual(InventoryAdjustment.objects.count(), 1)

    def test_adjustment_cannot_reduce_stock_below_reservations(self):
        response = self.client.post(
            f"/api/v1/branches/{self.branch.pk}/inventory/adjustments/",
            {
                "product_id": str(self.product.pk),
                "quantity_delta": -8,
                "reason": "Correct stock count",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="mint-stock-count-001",
        )

        self.inventory.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.inventory.stock_on_hand, 10)
        self.assertFalse(InventoryAdjustment.objects.exists())

    def test_reusing_an_idempotency_key_for_a_different_change_conflicts(self):
        url = f"/api/v1/branches/{self.branch.pk}/inventory/adjustments/"
        headers = {"HTTP_IDEMPOTENCY_KEY": "mint-adjustment-reuse-001"}
        first = self.client.post(
            url,
            {
                "product_id": str(self.product.pk),
                "quantity_delta": 2,
                "reason": "Received delivery",
            },
            format="json",
            **headers,
        )
        conflict = self.client.post(
            url,
            {
                "product_id": str(self.product.pk),
                "quantity_delta": 3,
                "reason": "Received delivery",
            },
            format="json",
            **headers,
        )

        self.inventory.refresh_from_db()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(self.inventory.stock_on_hand, 12)

    def test_inventory_settings_require_a_reason_and_write_an_audit_event(self):
        url = f"/api/v1/branches/{self.branch.pk}/inventory/{self.product.pk}/"
        missing_reason = self.client.patch(
            url,
            {"is_available": False},
            format="json",
        )
        updated = self.client.patch(
            url,
            {"is_available": False, "reason": "Temporarily unavailable"},
            format="json",
        )

        self.assertEqual(missing_reason.status_code, 400)
        self.assertEqual(updated.status_code, 200)
        self.assertFalse(updated.data["is_available"])
        self.assertTrue(AuditEvent.objects.filter(action="inventory.settings_updated").exists())

    def test_staff_imports_csv_for_assigned_branch_and_audits_changes(self):
        uploaded = SimpleUploadedFile(
            "inventory.csv",
            (
                "product_id,sku,product_name,stock_on_hand,is_available,price_override_minor\n"
                f"{self.product.pk},{self.product.sku},Mint,12,false,450\n"
            ).encode(),
            content_type="text/csv",
        )

        response = self.client.post(
            f"/api/v1/branches/{self.branch.pk}/inventory/import.csv",
            {"file": uploaded},
            format="multipart",
        )

        self.inventory.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["updated_count"], 1)
        self.assertEqual(self.inventory.stock_on_hand, 12)
        self.assertFalse(self.inventory.is_available)
        self.assertEqual(self.inventory.price_override_minor, 450)
        self.assertTrue(AuditEvent.objects.filter(action="inventory.csv_imported").exists())

    def test_staff_csv_import_cannot_set_stock_below_reservations(self):
        uploaded = SimpleUploadedFile(
            "inventory.csv",
            (
                "product_id,sku,product_name,stock_on_hand,is_available,price_override_minor\n"
                f"{self.product.pk},{self.product.sku},Mint,2,true,\n"
            ).encode(),
            content_type="text/csv",
        )

        response = self.client.post(
            f"/api/v1/branches/{self.branch.pk}/inventory/import.csv",
            {"file": uploaded},
            format="multipart",
        )

        self.inventory.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.inventory.stock_on_hand, 10)

    def test_csv_import_rolls_back_all_rows_when_any_stock_is_invalid(self):
        another_product = Product.objects.create(
            sku="MINT-002",
            slug="mint-02",
            category=self.product.category,
            name="Peppermint",
            unit="bunch",
            base_price_minor=600,
        )
        another_inventory = ProductBranch.objects.create(
            branch=self.branch,
            product=another_product,
            stock_on_hand=5,
            reserved_quantity=3,
        )
        uploaded = SimpleUploadedFile(
            "inventory.csv",
            (
                "product_id,sku,product_name,stock_on_hand,is_available,price_override_minor\n"
                f"{self.product.pk},{self.product.sku},Mint,12,true,\n"
                f"{another_product.pk},{another_product.sku},Peppermint,2,true,\n"
            ).encode(),
            content_type="text/csv",
        )

        response = self.client.post(
            f"/api/v1/branches/{self.branch.pk}/inventory/import.csv",
            {"file": uploaded},
            format="multipart",
        )

        self.inventory.refresh_from_db()
        another_inventory.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.inventory.stock_on_hand, 10)
        self.assertEqual(another_inventory.stock_on_hand, 5)
        self.assertFalse(InventoryAdjustment.objects.exists())

    def test_staff_csv_export_contains_only_the_assigned_branch_inventory(self):
        response = self.client.get(f"/api/v1/branches/{self.branch.pk}/inventory/export.csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("product_id,sku,product_name", response.content.decode())
        self.assertIn(str(self.product.pk), response.content.decode())
