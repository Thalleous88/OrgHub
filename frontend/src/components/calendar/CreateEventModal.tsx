import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateScopeCalendarEvent } from '../../hooks/queries/useCalendar';
import { useDivisionMembers, useProjectMembers, useOrganizationMembers, useDivisions } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';
import TaskDueInput from '../tasks/TaskDueInput';
import type { EventType, Scope } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  scopeId: number;
  scopeName?: string;
  defaultDate?: Date;
  organizationId?: number;
}

function toLocalInput(value: Date | undefined): string {
  if (!value) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default function CreateEventModal({ open, onClose, scope, scopeId, scopeName, defaultDate, organizationId }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('MEETING');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultDate));
  const [endsAt, setEndsAt] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const createMut = useCreateScopeCalendarEvent();
  const toast = useToast();

  const orgMembers = useOrganizationMembers(scope === 'organizations' ? scopeId : undefined);
  const divMembers = useDivisionMembers(scope === 'divisions' ? scopeId : undefined);
  const projMembers = useProjectMembers(scope === 'projects' ? scopeId : undefined);
  const { data: divisions } = useDivisions();

  const members = scope === 'organizations'
    ? orgMembers.data ?? null
    : scope === 'divisions'
      ? divMembers.data ?? null
      : projMembers.data ?? null;

  const orgDivisions = organizationId
    ? (divisions ?? []).filter((d) => d.organization === organizationId)
    : [];

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setEventType('MEETING');
      setLocation('');
      setStartsAt(toLocalInput(defaultDate));
      setEndsAt('');
      setAssigneeSearch('');
      setSelectedAssignees([]);
      setSelectedDivisionIds([]);
      setError('');
    }
  }, [open, defaultDate]);

  const filteredMembers = (members ?? []).filter((m) => {
    const q = assigneeSearch.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q)
    );
  });

  const toggleAssignee = (email: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  };

  const toggleDivision = (divId: number) => {
    setSelectedDivisionIds((prev) =>
      prev.includes(divId) ? prev.filter((id) => id !== divId) : [...prev, divId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createMut.mutateAsync({
        scope,
        scopeId,
        input: {
          title,
          description,
          event_type: eventType,
          location,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          assigned_emails: selectedAssignees.length > 0 ? selectedAssignees : undefined,
          assigned_division_ids: scope === 'organizations' && selectedDivisionIds.length > 0 ? selectedDivisionIds : undefined,
        },
      });
      toast.success('Event created.');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create event.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New event"
      subtitle={scopeName ? `Scheduled for ${scopeName}.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-event-form" loading={createMut.isPending}>Create</Button>
        </>
      }
    >
      <form id="create-event-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Type">
            <Select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              <option value="MEETING">Meeting</option>
              <option value="EVENT">Event</option>
              <option value="MILESTONE">Milestone</option>
            </Select>
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Room 301 / Zoom" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Starts">
            <TaskDueInput
              value={startsAt}
              onChange={setStartsAt}
              required
              dateLabel="Start date"
              timeLabel="Start time"
            />
          </Field>
          <Field label="Ends">
            <TaskDueInput
              value={endsAt}
              onChange={setEndsAt}
              dateLabel="End date"
              timeLabel="End time"
            />
          </Field>
        </div>

        <Field label="Assignees" hint="Select individual members to assign to this event.">
          <Input
            placeholder="Search by name or email..."
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
          />
        </Field>
        <div
          style={{
            maxHeight: 150,
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
                  background: selectedAssignees.includes(m.email) ? 'var(--bg-active)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAssignees.includes(m.email)}
                  onChange={() => toggleAssignee(m.email)}
                />
                <span style={{ flex: 1, fontSize: '0.875rem' }}>
                  {m.full_name || m.email}
                </span>

              </label>
            ))
          )}
        </div>
        {selectedAssignees.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {selectedAssignees.length} assignee{selectedAssignees.length > 1 ? 's' : ''} selected
          </p>
        )}

        {scope === 'organizations' && orgDivisions.length > 0 && (
          <>
            <Field label="Assigned divisions" hint="Assign this event to specific divisions (org-scoped events only).">
              <div
                style={{
                  maxHeight: 120,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: 4,
                }}
              >
                {orgDivisions.map((d) => (
                  <label
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.4rem 0.5rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: selectedDivisionIds.includes(d.id) ? 'var(--bg-active)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDivisionIds.includes(d.id)}
                      onChange={() => toggleDivision(d.id)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>{d.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
