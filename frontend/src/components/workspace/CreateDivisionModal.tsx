import { useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Button, useToast } from '../ui';
import { useCreateDivision } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  onCreated?: (divisionId: number) => void;
}

export default function CreateDivisionModal({ open, onClose, organizationId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const createMut = useCreateDivision();
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
      const division = await createMut.mutateAsync({ organization_id: organizationId, name, description });
      toast.success(`Division "${division.name}" created.`);
      reset();
      onClose();
      onCreated?.(division.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create division.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create division"
      subtitle="Only Core Board members can create divisions."
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-div-form" loading={createMut.isPending}>Create</Button>
        </>
      }
    >
      <form id="create-div-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}
        <Field label="Division name">
          <Input
            autoFocus
            placeholder="e.g. R&D"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
          />
        </Field>
        <Field label="Description">
          <Textarea
            placeholder="What does this division focus on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </Field>
      </form>
    </Modal>
  );
}
