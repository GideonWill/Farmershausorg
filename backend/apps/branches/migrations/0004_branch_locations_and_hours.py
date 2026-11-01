from django.db import migrations, models


BRANCH_LOCATIONS = {
    "dome": (5.655423, -0.232884),
    "westland": (5.650075, -0.209906),
    "north-legon": (5.670448, -0.181634),
    "east-legon": (5.659954, -0.151446),
}

OPENING_HOURS = {
    day: {"open": "09:00", "close": "18:00"}
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
}


def set_branch_locations(apps, schema_editor):
    Branch = apps.get_model("branches", "Branch")
    database = schema_editor.connection.alias
    for slug, (latitude, longitude) in BRANCH_LOCATIONS.items():
        Branch.objects.using(database).filter(slug=slug).update(
            latitude=latitude,
            longitude=longitude,
            opening_hours=OPENING_HOURS,
            hours_are_placeholder=True,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("branches", "0003_alter_branchpaymentaccount_credentials_secret_ref"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="branch",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="branch",
            name="opening_hours",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="branch",
            name="hours_are_placeholder",
            field=models.BooleanField(default=True),
        ),
        migrations.AddConstraint(
            model_name="branch",
            constraint=models.CheckConstraint(
                condition=models.Q(("latitude__isnull", True), ("longitude__isnull", True))
                | models.Q(("latitude__isnull", False), ("longitude__isnull", False)),
                name="branch_coordinates_both_present_or_absent",
            ),
        ),
        migrations.AddConstraint(
            model_name="branch",
            constraint=models.CheckConstraint(
                condition=models.Q(("latitude__isnull", True))
                | (models.Q(("latitude__gte", -90)) & models.Q(("latitude__lte", 90))),
                name="branch_latitude_in_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="branch",
            constraint=models.CheckConstraint(
                condition=models.Q(("longitude__isnull", True))
                | (models.Q(("longitude__gte", -180)) & models.Q(("longitude__lte", 180))),
                name="branch_longitude_in_range",
            ),
        ),
        migrations.RunPython(set_branch_locations, migrations.RunPython.noop),
    ]
