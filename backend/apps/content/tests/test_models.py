from django.test import TestCase

from apps.content.models import SiteSettings


class InitialSiteSettingsTests(TestCase):
    def test_contact_and_currency_settings_are_seeded(self):
        site = SiteSettings.objects.get(pk=1)

        self.assertEqual(site.primary_phone, "+233 55 420 8446")
        self.assertEqual(site.secondary_phone, "+233 55 048 8906")
        self.assertEqual(site.whatsapp_numbers, ["+233 55 420 8446", "+233 55 048 8906"])
        self.assertEqual(site.email, "info@farmershausgh.com")
        self.assertEqual(site.currency_code, "GHS")
        self.assertEqual(site.currency_symbol, "GH₵")
