from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("type", "0012_typefighterresult_mode")]

    operations = [
        migrations.AlterField(
            model_name="typefighterresult",
            name="difficulty",
            field=models.CharField(
                choices=[
                    ("easy", "Easy"),
                    ("normal", "Normal"),
                    ("hard", "Hard"),
                    ("extreme", "Extreme"),
                    ("custom", "Custom"),
                ],
                max_length=10,
            ),
        ),
        migrations.AddField("typefighterresult", "damage_received", models.PositiveIntegerField(default=0)),
        migrations.AddField("typefighterresult", "attacks_successful", models.PositiveIntegerField(default=0)),
        migrations.AddField("typefighterresult", "attacks_failed", models.PositiveIntegerField(default=0)),
        migrations.AddField("typefighterresult", "highest_wpm", models.PositiveIntegerField(default=0)),
        migrations.AddField("typefighterresult", "mistake_words", models.JSONField(blank=True, default=list)),
    ]
