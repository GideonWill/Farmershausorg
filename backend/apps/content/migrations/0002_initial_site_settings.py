from django.db import migrations


def create_initial_settings(apps, schema_editor):
    ContactSettings = apps.get_model("content", "ContactSettings")
    SiteSettings = apps.get_model("content", "SiteSettings")
    database = schema_editor.connection.alias
    ContactSettings.objects.using(database).get_or_create(pk=1)
    SiteSettings.objects.using(database).get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_initial_settings, migrations.RunPython.noop),
    ]
