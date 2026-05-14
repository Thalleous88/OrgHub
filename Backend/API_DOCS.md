# OrgHub Backend API Documentation

This document describes the implemented Django REST API surface for the OrgHub backend prototype.

## Base URL

All application routes are mounted under:

```text
/api/
```

Example:

```text
GET /api/auth/me/
```

## Authentication

Most endpoints require JWT authentication.

Use the access token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Public endpoints:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/token/`
- `POST /api/token/refresh/`
- `POST /api/token/verify/`

Prototype note: the PRD/SRS mentions university-domain email enforcement, but this backend intentionally accepts regular email/password for the prototype.

## Common Response Codes

- `200 OK`: Request succeeded.
- `201 Created`: Resource created.
- `204 No Content`: Resource deleted.
- `400 Bad Request`: Validation error or permission rule enforced by serializer validation.
- `401 Unauthorized`: Missing/invalid authentication.
- `403 Forbidden`: Authenticated user cannot access or mutate the resource.
- `404 Not Found`: Resource does not exist or is hidden by user-scoped queryset.

## Role Model

OrgHub uses scoped membership models instead of Django `Group`.

Organization roles:

- `CORE_BOARD`
- `MEMBER`

Division roles:

- `DIVISION_HEAD`
- `MEMBER`

Project roles:

- `PROJECT_LEAD`
- `MEMBER`

Invitation roles:

- `CORE_BOARD`
- `DIVISION_HEAD`
- `PROJECT_LEAD`
- `MEMBER`

Current hierarchy:

```text
Organization > Division > Project
```

The `Team` level from the PRD/SRS is not implemented yet.

## Data Formats

Datetimes are ISO 8601 strings.

Example:

```json
"2026-05-14T10:30:00Z"
```

File uploads use `multipart/form-data`.

Allowed document extensions:

- `.docx`
- `.xlsx`
- `.pptx`
- `.pdf`

Maximum document size: `100MB`.

## Auth And Profile

### Register

```http
POST /api/auth/register/
```

Creates a user, creates an empty `Profile`, and returns JWT tokens.

Request:

```json
{
  "email": "alex@example.com",
  "password": "Password123"
}
```

Response `201`:

```json
{
  "id": 1,
  "email": "alex@example.com",
  "access": "<jwt_access>",
  "refresh": "<jwt_refresh>"
}
```

Rules:

- Email is normalized to lowercase.
- Password minimum length is 8 characters.
- Email must be unique.
- `username` is stored as the email internally.

### Login

```http
POST /api/auth/login/
```

Request:

```json
{
  "email": "alex@example.com",
  "password": "Password123"
}
```

Response `200`:

```json
{
  "access": "<jwt_access>",
  "refresh": "<jwt_refresh>"
}
```

### Current User

```http
GET /api/auth/me/
```

Response `200`:

```json
{
  "id": 1,
  "email": "alex@example.com",
  "profile": {
    "full_name": "Alex Johnson",
    "major": "Computer Science",
    "campus_location": "Kemanggisan"
  },
  "memberships": {
    "organizations": [
      {"id": 1, "name": "OrgHub", "role": "CORE_BOARD"}
    ],
    "divisions": [
      {"id": 1, "name": "R&D", "organization_id": 1, "role": "DIVISION_HEAD"}
    ],
    "projects": [
      {"id": 1, "name": "Website", "division_id": 1, "role": "PROJECT_LEAD"}
    ]
  }
}
```

### Current User Profile

```http
GET /api/auth/profile/
PATCH /api/auth/profile/
PUT /api/auth/profile/
```

`GET` response `200`:

```json
{
  "full_name": "Alex Johnson",
  "major": "Computer Science",
  "campus_location": "Kemanggisan"
}
```

`PATCH` request:

```json
{
  "full_name": "Alex Johnson",
  "major": "Information Systems",
  "campus_location": "Alam Sutera"
}
```

Rules:

- Users can only access/update their own profile.
- If a profile is missing, the endpoint creates one for the current user.

### JWT Utility Routes

```http
POST /api/token/
POST /api/token/refresh/
POST /api/token/verify/
```

These are SimpleJWT defaults.

`POST /api/token/` expects Django's default username/password payload, not the frontend-facing email login payload.

## Organizations

### List Organizations

```http
GET /api/organizations/
```

Returns organizations where the current user has an active organization membership.

Response item:

```json
{
  "id": 1,
  "name": "OrgHub",
  "description": "Student organization workspace",
  "created_by": 1,
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Create Organization

```http
POST /api/organizations/
```

Request:

```json
{
  "name": "OrgHub",
  "description": "Student organization workspace"
}
```

Rules:

- Authenticated users can create organizations.
- The creator automatically becomes the first `CORE_BOARD` member.

## Divisions

### List Divisions

```http
GET /api/divisions/
```

Returns divisions where the current user is an active division member, plus divisions in organizations where the user is `CORE_BOARD`.

Response item:

```json
{
  "id": 1,
  "organization": 1,
  "name": "R&D",
  "description": "Research and development",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Create Division

```http
POST /api/divisions/
```

Request:

```json
{
  "organization_id": 1,
  "name": "R&D",
  "description": "Research and development"
}
```

Rules:

- Only `CORE_BOARD` of the organization can create divisions.
- Division names are unique per organization.

## Projects

### List Projects

```http
GET /api/projects/
```

Returns projects where the current user is an active project member, plus projects visible through `DIVISION_HEAD` or `CORE_BOARD` role.

Response item:

```json
{
  "id": 1,
  "division": 1,
  "name": "Website Revamp",
  "description": "Build the organization website",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Create Project

```http
POST /api/projects/
```

Request:

```json
{
  "division_id": 1,
  "name": "Website Revamp",
  "description": "Build the organization website"
}
```

Rules:

- `CORE_BOARD` or `DIVISION_HEAD` can create projects in a division they manage.
- Project names are unique per division.

## Invitations

Membership is invitation-only. Users cannot request access.

### Invite Organization Member

```http
POST /api/organizations/<organization_id>/invite/
```

Request:

```json
{
  "email": "member@example.com",
  "role": "MEMBER",
  "expires_at": "2026-06-01T00:00:00Z"
}
```

Allowed organization roles:

- `CORE_BOARD`
- `MEMBER`

Rules:

- Only organization `CORE_BOARD` can invite organization members.

### Invite Division Member

```http
POST /api/divisions/<division_id>/invite/
```

Request:

```json
{
  "email": "head@example.com",
  "role": "DIVISION_HEAD"
}
```

Allowed division roles:

- `DIVISION_HEAD`
- `MEMBER`

Rules:

- Only `CORE_BOARD` can assign `DIVISION_HEAD`.
- `CORE_BOARD` or `DIVISION_HEAD` can invite division `MEMBER` users.

### Invite Project Member

```http
POST /api/projects/<project_id>/invite/
```

Request:

```json
{
  "email": "lead@example.com",
  "role": "PROJECT_LEAD"
}
```

Allowed project roles:

- `PROJECT_LEAD`
- `MEMBER`

Rules:

- `CORE_BOARD` or `DIVISION_HEAD` can invite project members.
- Invitee must already be an active member of the parent division.

### Invitation Response Shape

Response `201`:

```json
{
  "id": 1,
  "email": "member@example.com",
  "organization": 1,
  "division": null,
  "project": null,
  "role": "MEMBER",
  "token": "0d4a2d0e-1d85-4c24-9f5e-d0fd9b0e9cb1",
  "status": "PENDING",
  "invited_by": 1,
  "accepted_by": null,
  "expires_at": null,
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

Invitation statuses:

- `PENDING`
- `ACCEPTED`
- `REVOKED`
- `EXPIRED`

### Accept Invitation

```http
POST /api/invitations/accept/
```

Request:

```json
{
  "token": "0d4a2d0e-1d85-4c24-9f5e-d0fd9b0e9cb1"
}
```

Rules:

- The authenticated user's email must match the invitation email.
- Expired invitations are marked `EXPIRED` and rejected.
- Accepting a division invitation also creates/activates organization membership as `MEMBER`.

## Documents / Resource Repository

Documents are scoped to exactly one organization, division, or project.

### List Or Upload Organization Documents

```http
GET /api/organizations/<organization_id>/documents/
POST /api/organizations/<organization_id>/documents/
```

Read access:

- Active organization members.

Upload access:

- Organization `CORE_BOARD` only.

### List Or Upload Division Documents

```http
GET /api/divisions/<division_id>/documents/
POST /api/divisions/<division_id>/documents/
```

Read access:

- Organization `CORE_BOARD`.
- Active division members.

Upload access:

- Organization `CORE_BOARD`.
- Division `DIVISION_HEAD`.

### List Or Upload Project Documents

```http
GET /api/projects/<project_id>/documents/
POST /api/projects/<project_id>/documents/
```

Read access:

- Organization `CORE_BOARD`.
- Parent division `DIVISION_HEAD`.
- Active project members.

Upload access:

- Organization `CORE_BOARD`.
- Parent division `DIVISION_HEAD`.
- Project `PROJECT_LEAD`.

### Upload Request

Use `multipart/form-data`.

Fields:

- `title`: string, required.
- `description`: string, optional.
- `file`: file, required.

Example:

```http
POST /api/divisions/1/documents/
Content-Type: multipart/form-data
```

### Document Response Shape

```json
{
  "id": 1,
  "title": "Workshop Slides",
  "description": "Intro workshop material",
  "file": "/media/resources/divisions/1/slides.pdf",
  "file_url": "http://localhost:8000/media/resources/divisions/1/slides.pdf",
  "repository_scope": "divisions",
  "repository_id": 1,
  "organization": null,
  "division": 1,
  "project": null,
  "uploaded_by": 1,
  "uploaded_by_email": "head@example.com",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

Repository scopes:

- `organizations`
- `divisions`
- `projects`

### Retrieve Or Delete Document

```http
GET /api/documents/<document_id>/
DELETE /api/documents/<document_id>/
```

Delete access:

- Organization document: organization `CORE_BOARD`.
- Division document: organization `CORE_BOARD` or division `DIVISION_HEAD`.
- Project document: organization `CORE_BOARD`, parent division `DIVISION_HEAD`, or project `PROJECT_LEAD`.

### Download Document

```http
GET /api/documents/<document_id>/download/
```

Returns a file response as an attachment.

## Tasks

Tasks belong to exactly one division or project.

Task statuses:

- `ToDo`
- `InProgress`
- `Done`

### List Tasks

```http
GET /api/tasks/
```

Returns tasks visible to the current user:

- Tasks created by the user.
- Tasks assigned to the user.
- Division tasks visible to `DIVISION_HEAD` or `CORE_BOARD`.
- Project tasks visible to `PROJECT_LEAD`, parent division `DIVISION_HEAD`, or organization `CORE_BOARD`.

### Create Task

```http
POST /api/tasks/
```

Division task request:

```json
{
  "division": 1,
  "title": "Prepare division plan",
  "description": "Draft quarterly roadmap",
  "status": "ToDo",
  "due_at": "2026-06-01T10:00:00Z",
  "assigned_to": 2
}
```

Project task request:

```json
{
  "project": 1,
  "title": "Prepare workshop slides",
  "description": "Create intro material",
  "status": "ToDo",
  "due_at": "2026-06-01T10:00:00Z",
  "assigned_to": 3
}
```

Rules:

- Task must have exactly one of `division` or `project`.
- Core Board can assign division tasks to Division Heads.
- Division Heads can assign project tasks to Project Leads.
- Project Leads can assign project tasks to project Members.

### Task Response Shape

```json
{
  "id": 1,
  "division": null,
  "project": 1,
  "title": "Prepare workshop slides",
  "description": "Create intro material",
  "status": "ToDo",
  "due_at": "2026-06-01T10:00:00Z",
  "created_by": 1,
  "created_by_email": "lead@example.com",
  "assigned_to": 3,
  "assigned_to_email": "member@example.com",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Retrieve, Update, Or Delete Task

```http
GET /api/tasks/<task_id>/
PATCH /api/tasks/<task_id>/
PUT /api/tasks/<task_id>/
DELETE /api/tasks/<task_id>/
```

Update rules:

- Task creator can update the task.
- Assigned user can update only `status`.
- Reassignment must still satisfy assignment hierarchy.

Delete rules:

- Only task creator can delete.

Assigned user status update example:

```json
{
  "status": "InProgress"
}
```

## Announcements

Announcements are organization-scoped broadcasts.

Announcement priorities:

- `LOW`
- `NORMAL`
- `HIGH`

### Global Announcement Feed

```http
GET /api/announcements/
```

Returns announcements from organizations where the current user is an active member.

### Organization Announcements

```http
GET /api/organizations/<organization_id>/announcements/
POST /api/organizations/<organization_id>/announcements/
```

Create request:

```json
{
  "title": "General Assembly",
  "content": "Meeting this Friday at 5 PM.",
  "priority": "HIGH"
}
```

Rules:

- Active organization members can read announcements.
- Only organization `CORE_BOARD` can create announcements.

### Announcement Response Shape

```json
{
  "id": 1,
  "organization": 1,
  "title": "General Assembly",
  "content": "Meeting this Friday at 5 PM.",
  "priority": "HIGH",
  "created_by": 1,
  "created_by_email": "core@example.com",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Retrieve Or Delete Announcement

```http
GET /api/announcements/<announcement_id>/
DELETE /api/announcements/<announcement_id>/
```

Rules:

- Organization members can retrieve.
- Only organization `CORE_BOARD` can delete.

## Calendar Events / Meetings / Milestones

Calendar events are scoped to exactly one organization, division, or project.

Event types:

- `EVENT`
- `MEETING`
- `MILESTONE`

### Unified Calendar Feed

```http
GET /api/calendar/events/
```

Optional query params:

- `starts_after`: ISO datetime, filters `starts_at >= value`.
- `starts_before`: ISO datetime, filters `starts_at <= value`.

Example:

```http
GET /api/calendar/events/?starts_after=2026-06-01T00:00:00Z&starts_before=2026-06-30T23:59:59Z
```

Returns calendar events visible through the user's active memberships and management roles.

### Organization Calendar Events

```http
GET /api/organizations/<organization_id>/calendar/events/
POST /api/organizations/<organization_id>/calendar/events/
```

Read access:

- Active organization members.

Manage access:

- Organization `CORE_BOARD`.

### Division Calendar Events

```http
GET /api/divisions/<division_id>/calendar/events/
POST /api/divisions/<division_id>/calendar/events/
```

Read access:

- Organization `CORE_BOARD`.
- Active division members.

Manage access:

- Organization `CORE_BOARD`.
- Division `DIVISION_HEAD`.

### Project Calendar Events

```http
GET /api/projects/<project_id>/calendar/events/
POST /api/projects/<project_id>/calendar/events/
```

Read access:

- Organization `CORE_BOARD`.
- Parent division `DIVISION_HEAD`.
- Active project members.

Manage access:

- Organization `CORE_BOARD`.
- Parent division `DIVISION_HEAD`.
- Project `PROJECT_LEAD`.

### Create Calendar Event Request

```json
{
  "title": "Weekly Mentoring Session",
  "description": "Discuss mentee progress",
  "event_type": "MEETING",
  "location": "Room 501",
  "starts_at": "2026-06-01T10:00:00Z",
  "ends_at": "2026-06-01T11:00:00Z"
}
```

Rules:

- `ends_at` is optional.
- If provided, `ends_at` cannot be before `starts_at`.
- Scope fields (`organization`, `division`, `project`) are assigned from the URL and are read-only in payloads.

### Calendar Event Response Shape

```json
{
  "id": 1,
  "organization": null,
  "division": null,
  "project": 1,
  "calendar_scope": "projects",
  "calendar_scope_id": 1,
  "title": "Weekly Mentoring Session",
  "description": "Discuss mentee progress",
  "event_type": "MEETING",
  "location": "Room 501",
  "starts_at": "2026-06-01T10:00:00Z",
  "ends_at": "2026-06-01T11:00:00Z",
  "created_by": 1,
  "created_by_email": "lead@example.com",
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

Calendar scopes:

- `organizations`
- `divisions`
- `projects`

### Retrieve, Update, Or Delete Calendar Event

```http
GET /api/calendar/events/<event_id>/
PATCH /api/calendar/events/<event_id>/
PUT /api/calendar/events/<event_id>/
DELETE /api/calendar/events/<event_id>/
```

Rules:

- Visible users can retrieve.
- Only users who can manage the event's scope can update/delete.

## Notifications / Reminders

Notifications are in-app prototype notifications.

Notification types:

- `TASK_REMINDER`
- `EVENT_REMINDER`
- `ANNOUNCEMENT`

Email/push delivery is not implemented yet.

### List Notifications

```http
GET /api/notifications/
```

Optional query param:

- `is_read=true`
- `is_read=false`

Example:

```http
GET /api/notifications/?is_read=false
```

Returns only notifications for the authenticated user.

### Notification Response Shape

```json
{
  "id": 1,
  "notification_type": "TASK_REMINDER",
  "title": "Task due soon: Prepare workshop slides",
  "message": "Prepare workshop slides is due at 2026-06-01T10:00:00+00:00.",
  "task": 1,
  "calendar_event": null,
  "is_read": false,
  "read_at": null,
  "created_at": "2026-05-14T10:30:00Z",
  "updated_at": "2026-05-14T10:30:00Z"
}
```

### Retrieve Or Mark Notification Read

```http
GET /api/notifications/<notification_id>/
PATCH /api/notifications/<notification_id>/
```

Mark read request:

```json
{
  "is_read": true
}
```

Rules:

- Users can only access their own notifications.
- Setting `is_read` to `true` also sets `read_at`.
- Setting `is_read` to `false` is ignored by the serializer.

### Mark All Notifications Read

```http
POST /api/notifications/mark-all-read/
```

Response `200`:

```json
{
  "detail": "Notifications marked as read."
}
```

### Generate Reminder Notifications

This is a management command, not an HTTP endpoint.

```bash
uv run python backend/manage.py generate_reminders
```

Optional window:

```bash
uv run python backend/manage.py generate_reminders --hours 48
```

Behavior:

- Default window is 24 hours from now.
- Creates task reminders for assigned users when incomplete tasks are due within the window.
- Creates event reminders for users who can see upcoming calendar events within the window.
- Prevents duplicate reminders for the same recipient/source/type.

Event reminder recipients:

- Organization event: active organization members.
- Division event: organization `CORE_BOARD` and active division members.
- Project event: organization `CORE_BOARD`, parent division `DIVISION_HEAD`, and active project members.

## Dashboard

### Current User Dashboard

```http
GET /api/dashboard/
```

Returns a read-only aggregation for the authenticated user.

Top-level response shape:

```json
{
  "profile": {
    "id": 1,
    "email": "alex@example.com",
    "full_name": "Alex Johnson",
    "major": "Information Systems",
    "campus_location": "Kemanggisan"
  },
  "memberships": {
    "organizations": [],
    "divisions": [],
    "projects": []
  },
  "tasks": {
    "assigned_to_me": [],
    "created_by_me": [],
    "managed": []
  },
  "announcements": [],
  "calendar_events": [],
  "notifications": [],
  "documents": [],
  "pending_invitations": [],
  "management_summary": {
    "organizations": [],
    "divisions": [],
    "projects": []
  }
}
```

Included data:

- Profile summary.
- Active memberships and roles.
- Recent assigned tasks.
- Recent tasks created by the user.
- Open managed tasks visible through Core Board, Division Head, or Project Lead roles.
- Latest visible announcements.
- Upcoming/visible calendar events.
- Recent notifications.
- Recent visible documents.
- Pending invitations matching the user's email.
- Management counts for organizations, divisions, and projects the user manages.

## Implemented Feature Coverage

Implemented:

- Authentication and JWT login.
- Current user profile/account settings.
- Scoped RBAC memberships.
- Organization/division/project hierarchy.
- Invitation-only membership flow.
- Task assignment and status workflow.
- Scoped document repositories.
- Organization announcements/broadcast feed.
- Calendar events, meetings, and milestones.
- Dashboard aggregation.
- In-app notifications and reminder generation command.

Partially implemented:

- Automated reminders: in-app reminders exist, but email/push delivery does not.
- Private/public channels: represented through scoped data, but no chat/message channel model exists.
- Document permissions: implemented, but versioning/approval/categorization are not.
- Mentoring coordination: project calendar meetings can represent sessions, but no dedicated `MentoringSession` model exists.

Not implemented:

- Team model.
- Dedicated mentoring session workflow.
- Document categorization.
- Document version control.
- Document approval workflow.
- Email/push notification delivery.
- University email domain restriction.
- Generated OpenAPI/Swagger endpoint.
- In-app help/FAQ/walkthrough backend.
