import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import CreateOrganizationModal from "../../components/workspace/CreateOrganizationModal";
import InviteMemberModal from "../../components/workspace/InviteMemberModal";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Tabs,
  useToast,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { getApiErrorMessage } from "../../lib/apiError";
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
} from "../../hooks/queries/useUser";
import {
  useLeaveOrganization,
  useOrganizations,
} from "../../hooks/queries/useWorkspace";
import { useDashboard } from "../../hooks/queries/useDashboard";
import { useAcceptInvitation } from "../../hooks/queries/useInvitations";
import type { Invitation, Organization } from "../../types/api";
import "./SettingsPage.css";

type SettingsTab = "profile" | "security" | "organizations";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dashboard } = useDashboard();
  const pendingInvitations = dashboard?.pending_invitations ?? [];
  const requestedTab = searchParams.get("tab");
  const activeTab: SettingsTab =
    requestedTab === "security" || requestedTab === "organizations"
      ? requestedTab
      : "profile";

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams(tab === "profile" ? {} : { tab });
  };

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security, and organization workspaces."
      />
      <Tabs
        active={activeTab}
        onChange={(tab) => setActiveTab(tab as SettingsTab)}
        tabs={[
          { key: "profile", label: "Profile" },
          { key: "security", label: "Security" },
          {
            key: "organizations",
            label: (
              <span className="settings-tab-label">
                Organization settings
                {pendingInvitations.length > 0 && (
                  <span
                    className="settings-pending-dot"
                    aria-label={`${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? "" : "s"}`}
                  />
                )}
              </span>
            ),
          },
        ]}
      />

      <div className="settings-content">
        {activeTab === "profile" && <ProfileSettings />}
        {activeTab === "security" && <SecuritySettings />}
        {activeTab === "organizations" && (
          <OrganizationSettings pendingInvitations={pendingInvitations} />
        )}
      </div>
    </AppShell>
  );
}

function ProfileSettings() {
  const { data: profile, isLoading, isError, error, refetch } = useProfile();

  if (isLoading) return <Spinner label="Loading profile..." />;
  if (isError) {
    return (
      <EmptyState
        title="Could not load profile"
        description={getApiErrorMessage(error, "Try again in a moment.")}
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!profile) return null;

  return <ProfileForm initialProfile={profile} />;
}

function ProfileForm({
  initialProfile,
}: {
  initialProfile: { full_name: string; major: string; campus_location: string };
}) {
  const { user, refreshUser } = useAuth();
  const updateMut = useUpdateProfile();
  const toast = useToast();
  const [fullName, setFullName] = useState(initialProfile.full_name ?? "");
  const [major, setMajor] = useState(initialProfile.major ?? "");
  const [campus, setCampus] = useState(initialProfile.campus_location ?? "");
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    try {
      await updateMut.mutateAsync({
        full_name: fullName,
        major,
        campus_location: campus,
      });
      await refreshUser();
      toast.success("Profile updated.");
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Failed to update profile."));
    }
  };

  return (
    <section className="settings-panel">
      <div className="settings-panel__intro">
        <span className="settings-panel__eyebrow">Personal details</span>
        <h2>Profile information</h2>
        <p>Keep the information your teammates see up to date.</p>
      </div>
      <form className="settings-form" onSubmit={handleSubmit}>
        {formError && <FormError message={formError} />}
        <Field label="Email" hint="Your account email cannot be changed here.">
          <Input value={user?.email ?? ""} readOnly disabled />
        </Field>
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
            maxLength={255}
          />
        </Field>
        <Field label="Major">
          <Input
            value={major}
            onChange={(event) => setMajor(event.target.value)}
            placeholder="e.g. Computer Science"
            maxLength={255}
          />
        </Field>
        <Field label="Campus location">
          <Input
            value={campus}
            onChange={(event) => setCampus(event.target.value)}
            placeholder="e.g. Main Campus"
            maxLength={255}
          />
        </Field>
        <div className="settings-form__actions">
          <Button variant="primary" type="submit" loading={updateMut.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </section>
  );
}

function SecuritySettings() {
  const changePwMut = useChangePassword();
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (oldPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }
    try {
      await changePwMut.mutateAsync({ oldPassword, newPassword });
      toast.success("Password changed.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to change password."));
    }
  };

  return (
    <section className="settings-panel">
      <div className="settings-panel__intro">
        <span className="settings-panel__eyebrow">Account security</span>
        <h2>Change password</h2>
        <p>Use a unique password with at least eight characters.</p>
      </div>
      <form className="settings-form" onSubmit={handleSubmit}>
        {error && <FormError message={error} />}
        <Field label="Current password">
          <Input
            type="password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            placeholder="Enter current password"
            required
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" hint="Must be at least 8 characters.">
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Enter new password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <div className="settings-form__actions">
          <Button
            variant="primary"
            type="submit"
            loading={changePwMut.isPending}
          >
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

function OrganizationSettings({
  pendingInvitations,
}: {
  pendingInvitations: Invitation[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { memberships, currentOrganizationId, setCurrentOrganization } =
    useWorkspace();
  const {
    data: organizations,
    isLoading,
    isError,
    error,
    refetch,
  } = useOrganizations();
  const leaveMut = useLeaveOrganization();
  const acceptMut = useAcceptInvitation();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOrganization, setInviteOrganization] =
    useState<Organization | null>(null);
  const [leaveOrganization, setLeaveOrganization] =
    useState<Organization | null>(null);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<
    number | null
  >(null);

  const membershipById = useMemo(
    () =>
      new Map(
        memberships.organizations.map((membership) => [
          membership.id,
          membership,
        ]),
      ),
    [memberships.organizations],
  );

  const switchWorkspace = (organization: Organization) => {
    setCurrentOrganization(organization.id);
    toast.success(`Switched to ${organization.name}.`);
    navigate(`/workspace/orgs/${organization.id}`);
  };

  const confirmLeave = async () => {
    if (!leaveOrganization) return;
    try {
      await leaveMut.mutateAsync(leaveOrganization.id);
      toast.success(`You left ${leaveOrganization.name}.`);
      setLeaveOrganization(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not leave the organization."));
    }
  };

  const acceptInvitation = async (invitation: Invitation) => {
    setAcceptingInvitationId(invitation.id);
    try {
      await acceptMut.mutateAsync(invitation.token);
      toast.success("Invitation accepted.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not accept the invitation."));
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  return (
    <>
      <section className="settings-organizations">
        <div className="settings-organizations__header">
          <div>
            <span className="settings-panel__eyebrow">Workspace directory</span>
            <h2>Your organizations</h2>
            <p>Choose your active workspace or manage your memberships.</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setCreateOpen(true)}
            leftIcon={<PlusIcon />}
          >
            Create organization
          </Button>
        </div>

        {isLoading ? (
          <Spinner label="Loading organizations..." />
        ) : isError ? (
          <EmptyState
            title="Could not load organizations"
            description={getApiErrorMessage(error, "Try again in a moment.")}
            action={
              <Button variant="secondary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : !organizations?.length ? (
          <EmptyState
            title="No organizations yet"
            description="Create an organization to start your own workspace."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create organization
              </Button>
            }
          />
        ) : (
          <div className="organization-list">
            {organizations.map((organization) => {
              const membership = membershipById.get(organization.id);
              const isCurrent = currentOrganizationId === organization.id;
              const canInvite = membership?.role === "CORE_BOARD";
              return (
                <article
                  key={organization.id}
                  className={`organization-row${isCurrent ? " organization-row--current" : ""}`}
                >
                  <div className="organization-row__mark" aria-hidden>
                    {organization.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="organization-row__body">
                    <div className="organization-row__title">
                      <h3>{organization.name}</h3>
                      {isCurrent && (
                        <Badge variant="teal">Current workspace</Badge>
                      )}
                      {membership && (
                        <Badge
                          variant={
                            membership.role === "CORE_BOARD"
                              ? "amber"
                              : "neutral"
                          }
                        >
                          {membership.role === "CORE_BOARD"
                            ? "Core Board"
                            : "Member"}
                        </Badge>
                      )}
                    </div>
                    <p>
                      {organization.description ||
                        "No organization description."}
                    </p>
                  </div>
                  <div className="organization-row__actions">
                    <Button
                      variant={isCurrent ? "ghost" : "secondary"}
                      size="sm"
                      disabled={isCurrent}
                      onClick={() => switchWorkspace(organization)}
                    >
                      {isCurrent ? "Active" : "Switch workspace"}
                    </Button>
                    {canInvite && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInviteOrganization(organization)}
                      >
                        Invite member
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setLeaveOrganization(organization)}
                    >
                      Leave
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="settings-invitations">
        <div className="settings-organizations__header">
          <div>
            <span className="settings-panel__eyebrow settings-panel__eyebrow--amber">
              Membership requests
            </span>
            <br />
            <h2 className="settings-invitations__title">
              Pending invitations
              {pendingInvitations.length > 0 && (
                <Badge variant="amber">{pendingInvitations.length}</Badge>
              )}
            </h2>
            <p>Review invitations to organizations, divisions, and projects.</p>
          </div>
        </div>

        {pendingInvitations.length === 0 ? (
          <div className="settings-invitations__empty">
            <MailIcon />
            <div>
              <strong>No pending invitations</strong>
              <p>New workspace invitations will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="invitation-list">
            {pendingInvitations.map((invitation) => (
              <article className="invitation-row" key={invitation.id}>
                <div className="invitation-row__icon">
                  <MailIcon />
                </div>
                <div className="invitation-row__body">
                  <div className="invitation-row__title">
                    <h3>{getInvitationScopeLabel(invitation)}</h3>
                    <Badge variant="amber">
                      {invitation.role.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p>
                    Sent to {invitation.email}
                    {invitation.expires_at
                      ? ` · Expires ${new Date(invitation.expires_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={
                    acceptMut.isPending &&
                    acceptingInvitationId === invitation.id
                  }
                  disabled={
                    acceptMut.isPending &&
                    acceptingInvitationId !== invitation.id
                  }
                  onClick={() => acceptInvitation(invitation)}
                >
                  Accept invitation
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <CreateOrganizationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(organizationId) => {
          setCurrentOrganization(organizationId);
          navigate(`/workspace/orgs/${organizationId}`);
        }}
      />

      {inviteOrganization && (
        <InviteMemberModal
          open
          onClose={() => setInviteOrganization(null)}
          scope="organizations"
          scopeId={inviteOrganization.id}
          scopeName={inviteOrganization.name}
          allowScopeSelection
        />
      )}

      <Modal
        open={Boolean(leaveOrganization)}
        onClose={() => setLeaveOrganization(null)}
        title={`Leave ${leaveOrganization?.name ?? "organization"}?`}
        subtitle="This removes your access to its divisions, projects, files, and updates."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOrganization(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={leaveMut.isPending}
              onClick={confirmLeave}
            >
              Leave organization
            </Button>
          </>
        }
      >
        <div className="settings-leave-warning">
          <strong>This action takes effect immediately.</strong>
          <p>
            Core Board members cannot leave when they are the
            organization&apos;s last active Core Board member.
          </p>
        </div>
      </Modal>
    </>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="login-form__error">
      <span>{message}</span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 2v10M2 7h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function getInvitationScopeLabel(invitation: Invitation): string {
  if (invitation.organization !== null) return "Organization invitation";
  if (invitation.division !== null) return "Division invitation";
  return "Project invitation";
}
