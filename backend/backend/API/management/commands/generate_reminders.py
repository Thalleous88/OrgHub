from datetime import timedelta

from django.core.management.base import BaseCommand

from API.services import generate_due_reminders


class Command(BaseCommand):
    help = "Generate in-app reminders for upcoming tasks and calendar events."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Reminder window in hours from now.",
        )

    def handle(self, *args, **options):
        created_count = generate_due_reminders(window=timedelta(hours=options["hours"]))
        self.stdout.write(
            self.style.SUCCESS(f"Created {created_count} reminder notification(s).")
        )
