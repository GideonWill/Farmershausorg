from rest_framework.test import APITestCase

from apps.accounts.models import BranchMembership, User
from apps.branches.models import Branch


class BranchApiTests(APITestCase):
    def test_active_branches_are_public(self):
        response = self.client.get("/api/v1/branches/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 4)

    def test_staff_branch_list_is_limited_to_active_memberships(self):
        user = User.objects.create_user(username="branch-staff", password="Random-Password-93!")
        dome = Branch.objects.get(slug="dome")
        BranchMembership.objects.create(user=user, branch=dome)
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/v1/staff/branches/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([branch["id"] for branch in response.data], [str(dome.pk)])

    def test_customers_cannot_access_staff_branch_list(self):
        user = User.objects.create_user(username="customer", password="Random-Password-93!")
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/v1/staff/branches/")

        self.assertEqual(response.status_code, 403)

    def test_nearest_branch_returns_distance_and_branch_details(self):
        dome = Branch.objects.get(slug="dome")
        response = self.client.get(
            "/api/v1/branches/nearest/",
            {"latitude": str(dome.latitude), "longitude": str(dome.longitude)},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["branch"]["id"], str(dome.pk))
        self.assertEqual(response.data["distance_km"], 0)
        self.assertIn("is_open", response.data["branch"])

    def test_nearest_branch_rejects_out_of_range_coordinates(self):
        response = self.client.get(
            "/api/v1/branches/nearest/?latitude=91&longitude=0"
        )

        self.assertEqual(response.status_code, 400)
