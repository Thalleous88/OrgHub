import { useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Select, Button, useToast } from '../ui';
import { useCreateAnnouncement } from '../../hooks/queries/useAnnouncements';
import { getApiErrorMessage } from '../../lib/apiError';
import type { AnnouncementPriority } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId?: number;
  organizationName?: string;
}

export default function CreateAnnouncementModal({
  open,
  onClose,
  organizationId,
  organizationName,
}: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [error, setError] = useState('');
  const createMut = useCreateAnnouncement();
  const toast = useToast();

  const reset = () => {
    setTitle('');
    setContent('');
    setPriority('NORMAL');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!organizationId) {
      setError('No organization selected.');
      return;
    }
    try {
      await createMut.mutateAsync({
        organizationId,
        input: { title, content, priority },
      });
      toast.success(`Announcement "${title}" posted.`);
      reset();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to post announcement.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Post announcement"
      subtitle={
        organizationName
          ? `Visible to members of ${organizationName}.`
          : 'Visible to organization members.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-announcement-form"
            loading={createMut.isPending}
            disabled={!organizationId}
          >
            Post
          </Button>
        </>
      }
    >
      <form
        id="create-announcement-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {error && (
          <div className="login-form__error">
            <span>{error}</span>
          </div>
        )}
        <Field label="Title">
          <Input
            autoFocus
            placeholder="e.g. Quarterly review on Friday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
          />
        </Field>
        <Field label="Content">
          <Textarea
            placeholder="Share the details of your announcement."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
          />
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
