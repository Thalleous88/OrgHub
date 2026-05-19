import { useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Button, useToast } from '../ui';
import { useCreateOrganization } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (organizationId: number) => void;
}

export default function CreateOrganizationModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const createMut = useCreateOrganization();
  const toast = useToast();

  const reset = () => {
    setName('');
    setDescription('');
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const org = await createMut.mutateAsync({ name, description });
      toast.success(`Organization "${org.name}" created.`);
      reset();
      onClose();
      onCreated?.(org.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create organization.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create organization"
      subtitle="You'll be added as the first Core Board member."
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-org-form"
            loading={createMut.isPending}
          >
            Create
          </Button>
        </>
      }
    >
      <form id="create-org-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div className="login-form__error">
            <span>{error}</span>
          </div>
        )}
        <Field label="Name" hint="The full display name of your organization.">
          <Input
            autoFocus
            placeholder="e.g. Student Executive Board"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
          />
        </Field>
        <Field label="Description" hint="Optional. Add a short mission statement or summary.">
          <Textarea
            placeholder="What does this organization do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </Field>
      </form>
    </Modal>
  );
}
