import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateTask } from '../../hooks/queries/useTasks';
import { getApiErrorMessage } from '../../lib/apiError';
import type { TaskStatus } from '../../types/api';

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
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [error, setError] = useState('');
  const createMut = useCreateTask();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStatus('ToDo');
      setDueAt('');
      setAssigneeEmail('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!defaultScope) {
      setError('Open this dialog from a division or project to create a task.');
      return;
    }
    const assignedToNumeric = Number(assigneeEmail);
    if (!assignedToNumeric || Number.isNaN(assignedToNumeric)) {
      setError(
        'Enter the numeric user ID of the assignee. The backend has no member directory yet, so IDs must be looked up from your team.',
      );
      return;
    }

    try {
      await createMut.mutateAsync({
        title,
        description,
        status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        assigned_to: assignedToNumeric,
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
        <Field
          label="Assignee user ID"
          hint="Backend has no member-list endpoint yet. Use the numeric user ID for now."
        >
          <Input
            value={assigneeEmail}
            onChange={(e) => setAssigneeEmail(e.target.value)}
            placeholder="e.g. 2"
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
