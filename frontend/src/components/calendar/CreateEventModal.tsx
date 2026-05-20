import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateScopeCalendarEvent } from '../../hooks/queries/useCalendar';
import { getApiErrorMessage } from '../../lib/apiError';
import type { EventType, Scope } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  scopeId: number;
  scopeName?: string;
  defaultDate?: Date;
}

function toLocalInput(value: Date | undefined): string {
  if (!value) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default function CreateEventModal({ open, onClose, scope, scopeId, scopeName, defaultDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('MEETING');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultDate));
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState('');
  const createMut = useCreateScopeCalendarEvent();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setEventType('MEETING');
      setLocation('');
      setStartsAt(toLocalInput(defaultDate));
      setEndsAt('');
      setError('');
    }
  }, [open, defaultDate]);

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
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </Field>
          <Field label="Ends">
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
