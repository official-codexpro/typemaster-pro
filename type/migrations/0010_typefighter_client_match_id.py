from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("type", "0009_car_finish_position_unknown")]

    operations = [
        migrations.AddField(
            model_name="typefighterresult",
            name="client_match_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="typefighterresult",
            constraint=models.UniqueConstraint(
                fields=("user", "client_match_id"),
                name="unique_type_fighter_client_match",
            ),
        ),
    ]
