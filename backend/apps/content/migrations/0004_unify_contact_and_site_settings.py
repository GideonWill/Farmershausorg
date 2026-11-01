from django.db import migrations


def copy_contact_settings(apps, schema_editor):
    ContactSettings = apps.get_model("content", "ContactSettings")
    SiteSettings = apps.get_model("content", "SiteSettings")
    database = schema_editor.connection.alias
    contacts = ContactSettings.objects.using(database).filter(pk=1).first()
    site, _ = SiteSettings.objects.using(database).get_or_create(pk=1)
    if contacts:
        SiteSettings.objects.using(database).filter(pk=1).update(
            primary_phone=contacts.primary_phone,
            secondary_phone=contacts.secondary_phone,
            whatsapp_numbers=contacts.whatsapp_numbers,
            email=contacts.email,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0003_contact_settings_content_fields"),
    ]

    operations = [
        migrations.RunPython(copy_contact_settings, migrations.RunPython.noop),
        migrations.DeleteModel(name="ContactSettings"),
    ]
