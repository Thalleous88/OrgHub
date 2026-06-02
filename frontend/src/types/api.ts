export type OrgRole = 'CORE_BOARD' | 'MEMBER';
export type DivisionRole = 'DIVISION_HEAD' | 'MEMBER';
export type ProjectRole = 'PROJECT_LEAD' | 'MEMBER';
export type InvitationRole = 'CORE_BOARD' | 'DIVISION_HEAD' | 'PROJECT_LEAD' | 'MEMBER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type TaskStatus = 'ToDo' | 'InProgress' | 'Done';
export type EventType = 'EVENT' | 'MEETING' | 'MILESTONE';
export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type NotificationType = 'TASK_REMINDER' | 'EVENT_REMINDER' | 'ANNOUNCEMENT';
export type Scope = 'organizations' | 'divisions' | 'projects';

export interface Profile {
  full_name: string;
  major: string;
  campus_location: string;
}

export interface MemberItem {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  joined_at: string;
}

export interface OrgMembershipSummary {
  id: number;
  name: string;
  role: OrgRole;
}

export interface DivisionMembershipSummary {
  id: number;
  name: string;
  organization_id: number;
  role: DivisionRole;
}

export interface ProjectMembershipSummary {
  id: number;
  name: string;
  division_id: number;
  role: ProjectRole;
}

export interface MembershipsBundle {
  organizations: OrgMembershipSummary[];
  divisions: DivisionMembershipSummary[];
  projects: ProjectMembershipSummary[];
}

export interface CurrentUser {
  id: number;
  email: string;
  profile: Profile;
  memberships: MembershipsBundle;
}

export interface Organization {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: number;
  organization: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  division: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: number;
  email: string;
  organization: number | null;
  division: number | null;
  project: number | null;
  role: InvitationRole;
  token: string;
  status: InvitationStatus;
  invited_by: number;
  accepted_by: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  division: number | null;
  project: number | null;
  title: string;
  description: string;
  status: TaskStatus;
  due_at: string | null;
  created_by: number;
  created_by_email: string;
  assigned_to: number[];
  assigned_to_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: number;
  organization: number | null;
  division: number | null;
  project: number | null;
  calendar_scope: Scope;
  calendar_scope_id: number;
  title: string;
  description: string;
  event_type: EventType;
  location: string;
  starts_at: string;
  ends_at: string | null;
  created_by: number;
  created_by_email: string;
  assigned_to: number[];
  assigned_to_emails: string[];
  assigned_divisions: number[];
  assigned_division_names: string[];
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: number;
  organization: number;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  created_by: number;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  task: number | null;
  calendar_event: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceDocument {
  id: number;
  title: string;
  description: string;
  file: string;
  file_url: string;
  repository_scope: Scope;
  repository_id: number;
  organization: number | null;
  division: number | null;
  project: number | null;
  uploaded_by: number;
  uploaded_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface ManagementOrgSummary {
  id: number;
  name: string;
  divisions_count: number;
  projects_count: number;
  open_tasks_count: number;
}

export interface ManagementDivisionSummary {
  id: number;
  name: string;
  organization_id: number;
  projects_count: number;
  open_tasks_count: number;
}

export interface ManagementProjectSummary {
  id: number;
  name: string;
  division_id: number;
  members_count: number;
  open_tasks_count: number;
}

export interface DashboardData {
  profile: {
    id: number;
    email: string;
    full_name: string;
    major: string;
    campus_location: string;
  };
  memberships: MembershipsBundle;
  tasks: {
    assigned_to_me: Task[];
    created_by_me: Task[];
    managed: Task[];
  };
  announcements: Announcement[];
  calendar_events: CalendarEvent[];
  notifications: Notification[];
  documents: ResourceDocument[];
  pending_invitations: Invitation[];
  management_summary: {
    organizations: ManagementOrgSummary[];
    divisions: ManagementDivisionSummary[];
    projects: ManagementProjectSummary[];
  };
}
