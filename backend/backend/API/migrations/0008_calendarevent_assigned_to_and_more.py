from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0007_task_assigned_to_manytomany"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="calendarevent",
            name="assigned_to",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_calendar_events",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="calendarevent",
            name="assigned_divisions",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_calendar_events",
                to="API.division",
            ),
        ),
    ]
