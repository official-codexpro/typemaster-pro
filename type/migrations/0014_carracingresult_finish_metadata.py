from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("type", "0013_typefighter_difficulty_analytics"),
    ]

    operations = [
        migrations.AddField(
            model_name="carracingresult",
            name="finish_words_typed",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="carracingresult",
            name="finish_time",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
