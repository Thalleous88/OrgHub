from django.contrib import admin

from .models import (
    Announcement,
    Division,
    DivisionMembership,
    Invitation,
    Organization,
    OrganizationMembership,
    Profile,
    Project,
    ProjectMembership,
    ResourceDocument,
    Task,
)


admin.site.register(Profile)
admin.site.register(Organization)
admin.site.register(Division)
admin.site.register(Project)
admin.site.register(OrganizationMembership)
admin.site.register(DivisionMembership)
admin.site.register(ProjectMembership)
admin.site.register(Invitation)
admin.site.register(ResourceDocument)
admin.site.register(Announcement)
admin.site.register(Task)
