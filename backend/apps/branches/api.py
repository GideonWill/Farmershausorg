from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.branches.models import Branch


def validate_active_branch_id(value):
    branch_id = serializers.UUIDField().run_validation(value)
    if not Branch.objects.filter(pk=branch_id, is_active=True).exists():
        raise ValidationError({"branch": "Select an active branch."})
    return branch_id
