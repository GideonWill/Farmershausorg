from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import TestCase

from apps.branches.models import Branch


class LaunchBranchTests(TestCase):
    def test_launch_branches_are_seeded_as_editable_records(self):
        branches = dict(Branch.objects.values_list("slug", "address"))

        self.assertEqual(len(branches), 4)
        self.assertEqual(branches["dome"], "Aggrey Street, Dome, Accra")
        self.assertEqual(
            branches["westland"],
            "14 Ato Ahwoi Ave, Westland Junction, Accra",
        )
        self.assertEqual(
            branches["north-legon"],
            "Wisconsin Road, Adjacent Antis, North Legon, Accra",
        )
        self.assertEqual(
            branches["east-legon"],
            "ARS Roundabout, East Legon, Accra",
        )

    def test_seeded_branch_locations_and_placeholder_hours_exist(self):
        branches = Branch.objects.filter(is_active=True)

        self.assertEqual(branches.count(), 4)
        self.assertTrue(all(branch.latitude is not None for branch in branches))
        self.assertTrue(all(branch.longitude is not None for branch in branches))
        self.assertTrue(all(branch.hours_are_placeholder for branch in branches))

    def test_open_status_uses_local_hours_and_closed_days(self):
        branch = Branch.objects.get(slug="dome")
        branch.opening_hours = {
            "monday": {"open": "09:00", "close": "18:00"},
        }
        open_at = datetime(2026, 11, 2, 10, 0, tzinfo=ZoneInfo("Africa/Accra"))
        closed_at = datetime(2026, 11, 2, 18, 0, tzinfo=ZoneInfo("Africa/Accra"))
        sunday = datetime(2026, 11, 1, 10, 0, tzinfo=ZoneInfo("Africa/Accra"))

        self.assertTrue(branch.is_open(open_at))
        self.assertFalse(branch.is_open(closed_at))
        self.assertFalse(branch.is_open(sunday))
