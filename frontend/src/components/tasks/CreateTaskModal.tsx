import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateTask } from '../../hooks/queries/useTasks';
import { useDivisionMembers, useProjectMembers } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';
import type { MemberItem, TaskStatus } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultScope?: { type: 'division' | 'project'; id: number };
}

export default function CreateTaskModal({ open, onClose, defaultScope }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('ToDo');
  const [dueAt, setDueAt] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [error, setError] = useState('');
  const createMut = useCreateTask();
  const toast = useToast();

  const divMembers = useDivisionMembers(defaultScope?.type === 'division' ? defaultScope.id : undefined);
  const projMembers = useProjectMembers(defaultScope?.type === 'project' ? defaultScope.id : undefined);

  const members: MemberItem[] | null = defaultScope?.type === 'division'
    ? divMembers.data ?? null
    : projMembers.data ?? null;

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStatus('ToDo');
      setDueAt('');
      setSearch('');
      setSelectedEmails([]);
      setError('');
    }
  }, [open]);

  const filteredMembers = (members ?? []).filter((m) => {
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
    if (!defaultScope) {
      setError('Open this dialog from a division or project to create a task.');
      return;
    }

    try {
      await createMut.mutateAsync({
        title,
        description,
        status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        assigned_emails: selectedEmails.length > 0 ? selectedEmails : [],
        ...(defaultScope.type === 'division'
          ? { division: defaultScope.id }
          : { project: defaultScope.id }),
      });
      toast.success('Task created.');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create task.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      subtitle={
        defaultScope
          ? `Create a ${defaultScope.type} task.`
          : 'Open from a division or project page to choose a scope.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="create-task-form"
            loading={createMut.isPending}
          >
            Create task
          </Button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}
        <Field label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            placeholder="What needs doing?"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Add context, links, or acceptance criteria."
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="ToDo">To Do</option>
              <option value="InProgress">In Progress</option>
              <option value="Done">Done</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Assignees" hint="Select members to assign. If none selected, you will be self-assigned.">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <div
          style={{
            maxHeight: 180,
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 4,
          }}
        >
          {filteredMembers.length === 0 ? (
            <p style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {members === null ? 'Loading members...' : 'No members found.'}
            </p>
          ) : (
            filteredMembers.map((m) => (
              <label
                key={m.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.4rem 0.5rem',
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

              </label>
            ))
          )}
        </div>
        {selectedEmails.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {selectedEmails.length} assignee{selectedEmails.length > 1 ? 's' : ''} selected
          </p>
        )}
      </form>
    </Modal>
  );
}
