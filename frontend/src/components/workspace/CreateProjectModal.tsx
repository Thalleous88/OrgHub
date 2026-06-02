import { useState, type FormEvent } from 'react';
import { Modal, Field, Input, Textarea, Button, useToast } from '../ui';
import { useCreateProject } from '../../hooks/queries/useWorkspace';
import { getApiErrorMessage } from '../../lib/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  divisionId: number;
  onCreated?: (projectId: number) => void;
}

export default function CreateProjectModal({ open, onClose, divisionId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const createMut = useCreateProject();
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
      const project = await createMut.mutateAsync({ division_id: divisionId, name, description });
      toast.success(`Project "${project.name}" created.`);
      reset();
      onClose();
      onCreated?.(project.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create project.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create project"
      subtitle="Core Board and Division Heads can create projects."
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-proj-form" loading={createMut.isPending}>Create</Button>
        </>
      }
    >
      <form id="create-proj-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}
        <Field label="Project name">
          <Input
            autoFocus
            placeholder="e.g. OrgHub Portal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
          />
        </Field>
        <Field label="Description">
          <Textarea
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </Field>
      </form>
    </Modal>
  );
}
