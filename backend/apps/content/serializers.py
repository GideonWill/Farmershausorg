from rest_framework import serializers

from apps.content.models import SiteSettings


class ContactDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            "primary_phone",
            "secondary_phone",
            "whatsapp_numbers",
            "email",
            "social_links",
            "announcement_bar_text",
            "delivery_policy_text",
        )
        read_only_fields = fields


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ("currency_code", "currency_symbol", "tagline")
        read_only_fields = fields


class PublicSiteSettingsSerializer(serializers.Serializer):
    contact = ContactDetailsSerializer(source="*")
    site = SiteSettingsSerializer(source="*")
