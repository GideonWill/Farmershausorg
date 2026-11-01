import apps.content.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0002_initial_site_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="primary_phone",
            field=models.CharField(default="+233 55 420 8446", max_length=16),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="secondary_phone",
            field=models.CharField(default="+233 55 048 8906", max_length=16),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="whatsapp_numbers",
            field=models.JSONField(
                default=apps.content.models.default_whatsapp_numbers,
            ),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="email",
            field=models.EmailField(default="info@farmershausgh.com", max_length=254),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="social_links",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="announcement_bar_text",
            field=models.CharField(blank=True, max_length=240),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="delivery_policy_text",
            field=models.TextField(blank=True),
        ),
    ]
