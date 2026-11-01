from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.audit.models import AuditEvent


class AuditEventTests(TestCase):
    def test_events_are_immutable_after_creation(self):
        event = AuditEvent.objects.create(
            action="inventory.adjusted",
            resource_type="ProductBranch",
            resource_id="inventory-1",
        )

        event.action = "inventory.deleted"
        with self.assertRaises(ValidationError):
            event.save()
        with self.assertRaises(ValidationError):
            event.delete()
