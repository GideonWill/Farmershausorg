from rest_framework.test import APITestCase


class PublicSiteSettingsApiTests(APITestCase):
    def test_public_endpoint_returns_contact_and_storefront_settings(self):
        response = self.client.get("/api/v1/site-settings/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["contact"]["primary_phone"], "+233 55 420 8446")
        self.assertEqual(response.data["contact"]["social_links"], {})
        self.assertEqual(response.data["contact"]["announcement_bar_text"], "")
        self.assertEqual(response.data["site"]["currency_code"], "GHS")
