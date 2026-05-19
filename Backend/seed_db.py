import os
import sys
import django
from django.utils import timezone
from datetime import timedelta
from django.core.files.base import ContentFile

# Set up Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Config.settings')
django.setup()

from django.contrib.auth import get_user_model
from API.models import (
    Organization, Division, Project,
    OrganizationMembership, DivisionMembership, ProjectMembership,
    Task, Announcement, CalendarEvent, ResourceDocument, Notification, Profile
)

User = get_user_model()

def seed():
    print("Starting database seeding...")

    # 1. Get or create users & update profiles
    test_user, _ = User.objects.get_or_create(email='test@test.com', defaults={'username': 'test@test.com'})
    test_user.set_password('Password123')
    test_user.save()
    p1, _ = Profile.objects.get_or_create(user=test_user)
    p1.full_name = "Alex Mercer"
    p1.major = "Computer Science"
    p1.campus_location = "Alam Sutera"
    p1.save()

    div1_user, _ = User.objects.get_or_create(email='division1@division.com', defaults={'username': 'division1@division.com'})
    div1_user.set_password('Password123')
    div1_user.save()
    p2, _ = Profile.objects.get_or_create(user=div1_user)
    p2.full_name = "Sarah Jenkins"
    p2.major = "Information Systems"
    p2.campus_location = "Kemanggisan"
    p2.save()

    div2_user, _ = User.objects.get_or_create(email='division2@division.com', defaults={'username': 'division2@division.com'})
    div2_user.set_password('Password123')
    div2_user.save()
    p3, _ = Profile.objects.get_or_create(user=div2_user)
    p3.full_name = "Marcus Chen"
    p3.major = "Marketing Communications"
    p3.campus_location = "Senayan"
    p3.save()

    # Clear previous seeded objects to avoid duplicates
    Task.objects.all().delete()
    Notification.objects.all().delete()
    CalendarEvent.objects.all().delete()
    Announcement.objects.all().delete()
    ResourceDocument.objects.all().delete()
    ProjectMembership.objects.all().delete()
    DivisionMembership.objects.all().delete()
    OrganizationMembership.objects.all().delete()
    Project.objects.all().delete()
    Division.objects.all().delete()
    Organization.objects.all().delete()

    # 2. Create Organization
    bem = Organization.objects.create(
        name="Student Executive Board",
        description="The central student organization empowering university leadership.",
        created_by=test_user
    )

    # 3. Create Divisions
    rd = Division.objects.create(
        organization=bem,
        name="R&D",
        description="Research and software development team."
    )
    marketing = Division.objects.create(
        organization=bem,
        name="Marketing",
        description="Public relations, social media, and campaigns."
    )

    # 4. Create Project
    portal_project = Project.objects.create(
        division=rd,
        name="OrgHub Portal",
        description="Developing the premium university organization dashboard."
    )

    # 5. Create Memberships
    # test_user is Core Board of BEM, Member of R&D, Project Lead of Portal
    OrganizationMembership.objects.create(organization=bem, user=test_user, role=OrganizationMembership.Role.CORE_BOARD)
    DivisionMembership.objects.create(division=rd, user=test_user, role=DivisionMembership.Role.MEMBER)
    ProjectMembership.objects.create(project=portal_project, user=test_user, role=ProjectMembership.Role.PROJECT_LEAD)

    # div1_user is Member of BEM, Division Head of R&D, Member of Portal
    OrganizationMembership.objects.create(organization=bem, user=div1_user, role=OrganizationMembership.Role.MEMBER)
    DivisionMembership.objects.create(division=rd, user=div1_user, role=DivisionMembership.Role.DIVISION_HEAD)
    ProjectMembership.objects.create(project=portal_project, user=div1_user, role=ProjectMembership.Role.MEMBER)

    # div2_user is Member of BEM, Division Head of Marketing
    OrganizationMembership.objects.create(organization=bem, user=div2_user, role=OrganizationMembership.Role.MEMBER)
    DivisionMembership.objects.create(division=marketing, user=div2_user, role=DivisionMembership.Role.DIVISION_HEAD)

    # 6. Create Tasks
    t1 = Task.objects.create(
        project=portal_project,
        title="Design High-Fidelity Login Page",
        description="Implement split-screen layout with CSS gradients, custom glassmorphic inputs, and robust error display.",
        status=Task.Status.DONE,
        due_at=timezone.now() - timedelta(hours=2),
        created_by=div1_user,
        assigned_to=test_user
    )
    t2 = Task.objects.create(
        project=portal_project,
        title="Integrate Dashboard with Real Backend",
        description="Connect react frontend modules to python django REST framework endpoints using secure JWT access keys.",
        status=Task.Status.IN_PROGRESS,
        due_at=timezone.now() + timedelta(days=1, hours=4),
        created_by=div1_user,
        assigned_to=test_user
    )
    t3 = Task.objects.create(
        division=rd,
        title="Prepare Division Quarterly Review",
        description="Compile budget usage, task velocity graphs, and project milestones for the board presentation.",
        status=Task.Status.TODO,
        due_at=timezone.now() + timedelta(days=3, hours=8),
        created_by=test_user,
        assigned_to=test_user
    )
    t4 = Task.objects.create(
        division=marketing,
        title="Launch Recruitment Campaign",
        description="Publish recruitment posters, design IG feed layouts, and handle student Q&A in the forum.",
        status=Task.Status.TODO,
        due_at=timezone.now() + timedelta(days=5),
        created_by=div2_user,
        assigned_to=div2_user
    )

    # 7. Create Announcements
    Announcement.objects.create(
        organization=bem,
        created_by=test_user,
        title="Spring Innovation Summit 2026",
        content="Registration for the annual Spring Innovation Summit is officially open! Make sure to register your division team by Friday evening. Exciting prizes and certificates await!",
        priority=Announcement.Priority.HIGH
    )
    Announcement.objects.create(
        organization=bem,
        created_by=div1_user,
        title="Portal Testing & Verification Update",
        content="Our frontend and backend servers are running concurrently on local. Please test your dashboard access and let the R&D team know if you experience any connection errors.",
        priority=Announcement.Priority.NORMAL
    )

    # 8. Create Calendar Events
    # Event 1: Sync meeting (Starts now, ends in 1 hour -> LIVE NOW)
    CalendarEvent.objects.create(
        project=portal_project,
        created_by=div1_user,
        title="OrgHub Weekly Portal Sync",
        description="Sprint demo, issue review, and planning of task boards.",
        event_type=CalendarEvent.EventType.MEETING,
        location="Meeting Room 302 / Zoom",
        starts_at=timezone.now() - timedelta(minutes=15),
        ends_at=timezone.now() + timedelta(minutes=45)
    )
    # Event 2: General Assembly tomorrow
    CalendarEvent.objects.create(
        organization=bem,
        created_by=test_user,
        title="SEB General Assembly Meeting",
        description="All divisions monthly assembly and general broadcasts.",
        event_type=CalendarEvent.EventType.EVENT,
        location="Main Auditorium",
        starts_at=timezone.now() + timedelta(days=1),
        ends_at=timezone.now() + timedelta(days=1, hours=2)
    )

    # 9. Create Resource Documents
    ResourceDocument.objects.create(
        division=rd,
        uploaded_by=test_user,
        title="OrgHub Portal SRS Document",
        description="Comprehensive product requirement specifications, design schemas, and prototype wireframes.",
        file=ContentFile(b"srs spec file content", name="srs_document.pdf")
    )
    ResourceDocument.objects.create(
        division=rd,
        uploaded_by=test_user,
        title="Git Branching & Release Strategy",
        description="Version control workflows, branching conventions, pull request rules, and production deployment cycles.",
        file=ContentFile(b"branching guidelines", name="git_branching_strategy.pdf")
    )
    ResourceDocument.objects.create(
        division=rd,
        uploaded_by=test_user,
        title="UI/UX Component & Style Guide",
        description="Detailed visual system guidelines, interface design tokens, glassmorphic hover configurations, and interactive states.",
        file=ContentFile(b"design tokens guidelines", name="ui_ux_style_guide.pdf")
    )
    ResourceDocument.objects.create(
        division=rd,
        uploaded_by=test_user,
        title="Database Schema & Neon Pooler Specs",
        description="Detailed Neon PostgreSQL E-R schema definitions, table indexes, connection pooling optimizations, and seeder guides.",
        file=ContentFile(b"database schema diagrams", name="db_schema_specs.pdf")
    )
    ResourceDocument.objects.create(
        organization=bem,
        uploaded_by=test_user,
        title="SEB Guidebook 2026",
        description="Global regulations, core vision/mission, and standard operational procedures for BEM.",
        file=ContentFile(b"guidebook file content", name="seb_guidebook.pdf")
    )

    # 10. Create Notifications for test_user
    Notification.objects.create(
        recipient=test_user,
        notification_type=Notification.NotificationType.TASK_REMINDER,
        title="Task Due Soon",
        message="You have an upcoming task: Integrate Dashboard with Real Backend. Due in 1 day.",
        task=t2
    )

    print("Database seeded successfully with beautiful sample data!")

if __name__ == '__main__':
    seed()
