from django.db import migrations, models


def clear_legacy_finish_places(apps, schema_editor):
    CarRacingResult = apps.get_model("type", "CarRacingResult")
    CarRacingResult.objects.filter(finish_position=5).update(finish_position=0)


class Migration(migrations.Migration):

    dependencies = [
        ("type", "0008_carracingresult_mode_language"),
    ]

    operations = [
        migrations.RunPython(clear_legacy_finish_places, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="carracingresult",
            name="finish_position",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
