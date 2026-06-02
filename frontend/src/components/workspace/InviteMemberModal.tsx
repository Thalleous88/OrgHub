import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Textarea, Select, Button, Input, useToast } from '../ui';
import {
  useInviteToOrganization,
  useInviteToDivision,
  useInviteToProject,
  useOrganizationMembers,
  useDivisionMembers,
  useProjectMembers,
} from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';
import type { MemberItem, Scope } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  scopeId: number;
  scopeName: string;
  parentScopeId?: number;
  orgId?: number;
}

export default function InviteMemberModal({ open, onClose, scope, scopeId, scopeName, parentScopeId, orgId }: Props) {
  const [mode, setMode] = useState<'picker' | 'email'>(parentScopeId ? 'picker' : 'email');
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailsText, setEmailsText] = useState('');
  const [role, setRole] = useState<string>(() => defaultRole(scope));
  const [error, setError] = useState('');
  const toast = useToast();

  const orgMut = useInviteToOrganization(scope === 'organizations' ? scopeId : 0);
  const divMut = useInviteToDivision(scope === 'divisions' ? scopeId : 0);
  const projMut = useInviteToProject(scope === 'projects' ? scopeId : 0);

  const activeMut =
    scope === 'organizations' ? orgMut : scope === 'divisions' ? divMut : projMut;

  const parentMembers = useParentMembers(scope, parentScopeId, orgId);
  const targetMembers = useTargetMembers(scope, scopeId);

  const existingEmails = new Set((targetMembers ?? []).map((m) => m.email));
  const availableMembers = (parentMembers ?? []).filter((m) => !existingEmails.has(m.email));

  useEffect(() => {
    if (open) {
      setMode(parentScopeId ? 'picker' : 'email');
      setSearch('');
      setSelectedEmails([]);
      setEmailsText('');
      setRole(defaultRole(scope));
      setError('');
    }
  }, [open, parentScopeId, scope]);

  const reset = () => {
    setSearch('');
    setSelectedEmails([]);
    setEmailsText('');
    setRole(defaultRole(scope));
    setError('');
  };

  const filteredMembers = availableMembers.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q)
    );
  });

  const toggleMember = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const emails = mode === 'picker' ? selectedEmails : emailsText
      .split(/[,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) {
      setError('Select at least one member or enter email addresses.');
      return;
    }

    try {
      if (scope === 'organizations') {
        await orgMut.mutateAsync({ emails, role: role as 'CORE_BOARD' | 'MEMBER' });
      } else if (scope === 'divisions') {
        await divMut.mutateAsync({ emails, role: role as 'DIVISION_HEAD' | 'MEMBER' });
      } else {
        await projMut.mutateAsync({ emails, role: role as 'PROJECT_LEAD' | 'MEMBER' });
      }
      toast.success(`Invitation(s) sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}.`);
      reset();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send invitation(s).'));
    }
  };

  const roleOptions = (() => {
    if (scope === 'organizations') {
      return [
        { value: 'MEMBER', label: 'Member' },
        { value: 'CORE_BOARD', label: 'Core Board' },
      ];
    }
    if (scope === 'divisions') {
      return [
        { value: 'MEMBER', label: 'Member' },
        { value: 'DIVISION_HEAD', label: 'Division Head' },
      ];
    }
    return [
      { value: 'MEMBER', label: 'Member' },
      { value: 'PROJECT_LEAD', label: 'Project Lead' },
    ];
  })();

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={`Invite to ${scopeName}`}
      subtitle="Select members from the parent scope or enter emails."
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="invite-form"
            loading={activeMut.isPending}
          >
            Send invite
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}

        {parentScopeId && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <Button
              variant={mode === 'picker' ? 'primary' : 'ghost'}
              size="sm"
              type="button"
              onClick={() => setMode('picker')}
            >
              From member list
            </Button>
            <Button
              variant={mode === 'email' ? 'primary' : 'ghost'}
              size="sm"
              type="button"
              onClick={() => setMode('email')}
            >
              By email
            </Button>
          </div>
        )}

        {mode === 'picker' && parentScopeId ? (
          <>
            <Field label="Search members">
              <Input
                autoFocus
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 4,
              }}
            >
              {filteredMembers.length === 0 ? (
                <p style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {parentMembers && parentMembers.length > 0 && availableMembers.length === 0
                    ? 'All members from the parent scope have already been added.'
                    : 'No members found.'}
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <label
                    key={m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.5rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: selectedEmails.includes(m.email) ? 'var(--bg-active)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(m.email)}
                      onChange={() => toggleMember(m.email)}
                    />
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>
                      {m.full_name || m.email}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {m.email}
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedEmails.length > 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {selectedEmails.length} member{selectedEmails.length > 1 ? 's' : ''} selected
              </p>
            )}
          </>
        ) : (
          <Field label="Email addresses" hint="Separate multiple emails with commas or new lines.">
            <Textarea
              autoFocus
              placeholder="alice@example.com, bob@example.com"
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              rows={3}
              required
            />
          </Field>
        )}

        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>
        {scope === 'projects' && mode === 'email' && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Note: invitees must already be members of the organization.
          </p>
        )}
      </form>
    </Modal>
  );
}

function useParentMembers(scope: Scope, parentScopeId?: number, orgId?: number): MemberItem[] | null {
  const orgMembers = useOrganizationMembers(scope === 'divisions' ? parentScopeId : orgId);
  const divMembers = useDivisionMembers(scope === 'projects' && !orgId ? parentScopeId : undefined);

  if (scope === 'divisions' && parentScopeId) return orgMembers.data ?? null;
  if (scope === 'projects' && orgId) return orgMembers.data ?? null;
  if (scope === 'projects' && parentScopeId) return divMembers.data ?? null;
  return null;
}

function useTargetMembers(scope: Scope, scopeId: number): MemberItem[] | null {
  const divMembers = useDivisionMembers(scope === 'divisions' ? scopeId : undefined);
  const projMembers = useProjectMembers(scope === 'projects' ? scopeId : undefined);

  if (scope === 'divisions') return divMembers.data ?? null;
  if (scope === 'projects') return projMembers.data ?? null;
  return null;
}

function defaultRole(scope: Scope): string {
  if (scope === 'organizations') return 'MEMBER';
  if (scope === 'divisions') return 'MEMBER';
  return 'MEMBER';
}
