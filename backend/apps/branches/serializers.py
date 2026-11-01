from rest_framework import serializers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field

from apps.branches.models import Branch, DeliveryZone


class BranchSerializer(serializers.ModelSerializer):
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = (
            "id",
            "slug",
            "name",
            "address",
            "phone",
            "latitude",
            "longitude",
            "opening_hours",
            "hours_are_placeholder",
            "is_open",
            "is_active",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_open(self, branch) -> bool:
        return branch.is_open()


class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = (
            "id",
            "name",
            "area_description",
            "postcodes",
            "delivery_fee_minor",
            "minimum_order_minor",
        )
        read_only_fields = fields


class NearestBranchResponseSerializer(serializers.Serializer):
    branch = BranchSerializer()
    distance_km = serializers.FloatField()
