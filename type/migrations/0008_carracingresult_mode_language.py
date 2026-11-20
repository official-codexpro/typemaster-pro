from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("type", "0007_testresult_certificate"),
    ]

    operations = [
        migrations.AddField(
            model_name="carracingresult",
            name="mode",
            field=models.CharField(
                choices=[("paragraph", "Paragraph Race"), ("code", "Code Syntax Race")],
                default="paragraph",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="carracingresult",
            name="language",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="carracingresult",
            name="finish_position",
            field=models.PositiveSmallIntegerField(default=5),
        ),
    ]
