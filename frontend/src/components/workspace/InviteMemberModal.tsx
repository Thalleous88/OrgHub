import { useState, type FormEvent } from 'react';
import { Modal, Field, Input, Select, Button, useToast } from '../ui';
import {
  useInviteToOrganization,
  useInviteToDivision,
  useInviteToProject,
} from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';
import type { Scope } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  scopeId: number;
  scopeName: string;
}

export default function InviteMemberModal({ open, onClose, scope, scopeId, scopeName }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(() => defaultRole(scope));
  const [error, setError] = useState('');
  const toast = useToast();

  const orgMut = useInviteToOrganization(scope === 'organizations' ? scopeId : 0);
  const divMut = useInviteToDivision(scope === 'divisions' ? scopeId : 0);
  const projMut = useInviteToProject(scope === 'projects' ? scopeId : 0);

  const activeMut =
    scope === 'organizations' ? orgMut : scope === 'divisions' ? divMut : projMut;

  const reset = () => {
    setEmail('');
    setRole(defaultRole(scope));
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (scope === 'organizations') {
        await orgMut.mutateAsync({ email, role: role as 'CORE_BOARD' | 'MEMBER' });
      } else if (scope === 'divisions') {
        await divMut.mutateAsync({ email, role: role as 'DIVISION_HEAD' | 'MEMBER' });
      } else {
        await projMut.mutateAsync({ email, role: role as 'PROJECT_LEAD' | 'MEMBER' });
      }
      toast.success(`Invitation sent to ${email}.`);
      reset();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send invitation.'));
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
      subtitle="The user will receive an invitation token."
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
        <Field label="Email">
          <Input
            autoFocus
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>
        {scope === 'projects' && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Note: invitees must already be members of the parent division.
          </p>
        )}
      </form>
    </Modal>
  );
}

function defaultRole(scope: Scope): string {
  if (scope === 'organizations') return 'MEMBER';
  if (scope === 'divisions') return 'MEMBER';
  return 'MEMBER';
}
