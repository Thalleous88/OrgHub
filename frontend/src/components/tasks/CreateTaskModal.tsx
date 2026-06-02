import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateTask } from '../../hooks/queries/useTasks';
import { useDivisionMembers, useProjectMembers } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';
import type { MemberItem, TaskStatus } from '../../types/api';
import type { TaskCreateInput } from '../../services/tasks';

type ScopeType = 'personal' | 'division' | 'project';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultScope?: { type: 'division' | 'project'; id: number };
  divisions?: { id: number; name: string }[];
  projects?: { id: number; name: string }[];
}

export default function CreateTaskModal({ open, onClose, defaultScope, divisions = [], projects = [] }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('ToDo');
  const [dueAt, setDueAt] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [error, setError] = useState('');

  const [scopeType, setScopeType] = useState<ScopeType>(defaultScope?.type ?? 'personal');
  const [scopeId, setScopeId] = useState<number>(defaultScope?.id ?? 0);

  const createMut = useCreateTask();
  const toast = useToast();

  const divMembers = useDivisionMembers(scopeType === 'division' ? scopeId : undefined);
  const projMembers = useProjectMembers(scopeType === 'project' ? scopeId : undefined);

  const members: MemberItem[] | null = scopeType === 'division'
    ? divMembers.data ?? null
    : scopeType === 'project'
    ? projMembers.data ?? null
    : null;

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStatus('ToDo');
      setDueAt('');
      setSearch('');
      setSelectedEmails([]);
      setError('');
      setScopeType(defaultScope?.type ?? 'personal');
      setScopeId(defaultScope?.id ?? 0);
    }
  }, [open, defaultScope]);

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

    try {
      const payload: TaskCreateInput = {
        title,
        description,
        status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        assigned_emails: scopeType !== 'personal' ? selectedEmails : [],
      };

      if (scopeType === 'division') {
        payload.division = scopeId;
      } else if (scopeType === 'project') {
        payload.project = scopeId;
      }

      await createMut.mutateAsync(payload);
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
        scopeType === 'personal'
          ? 'Create a personal task visible only to you and assignees.'
          : `Create a ${scopeType} task.`
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Scope">
            <Select value={scopeType} onChange={(e) => {
              const v = e.target.value as ScopeType;
              setScopeType(v);
              setScopeId(0);
              setSelectedEmails([]);
            }}>
              <option value="personal">Personal</option>
              {divisions.length > 0 && <option value="division">Division</option>}
              {projects.length > 0 && <option value="project">Project</option>}
            </Select>
          </Field>
          {scopeType === 'division' && (
            <Field label="Division">
              <Select value={scopeId || ''} onChange={(e) => { setScopeId(Number(e.target.value)); setSelectedEmails([]); }}>
                <option value="" disabled>Select division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {scopeType === 'project' && (
            <Field label="Project">
              <Select value={scopeId || ''} onChange={(e) => { setScopeId(Number(e.target.value)); setSelectedEmails([]); }}>
                <option value="" disabled>Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {scopeType !== 'personal' && (
          <>
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
                  {members === null ? 'Select a scope first.' : 'No members found.'}
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
          </>
        )}
      </form>
    </Modal>
  );
}
