from django.db import migrations


BRANCHES = [
    ("dome", "FarmersHaus Dome", "Aggrey Street, Dome, Accra"),
    ("westland", "FarmersHaus Westland", "14 Ato Ahwoi Ave, Westland Junction, Accra"),
    ("north-legon", "FarmersHaus North Legon", "Wisconsin Road, Adjacent Antis, North Legon, Accra"),
    ("east-legon", "FarmersHaus East Legon", "ARS Roundabout, East Legon, Accra"),
]


def create_launch_branches(apps, schema_editor):
    Branch = apps.get_model("branches", "Branch")
    database = schema_editor.connection.alias
    for slug, name, address in BRANCHES:
        Branch.objects.using(database).update_or_create(
            slug=slug,
            defaults={"name": name, "address": address, "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("branches", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_launch_branches, migrations.RunPython.noop),
    ]
