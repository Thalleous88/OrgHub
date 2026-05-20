import { useState, type DragEvent, type ChangeEvent } from 'react';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
} from '../../services/documents';
import { useUploadDocument } from '../../hooks/queries/useDocuments';
import { Button, Field, Input, Modal, Textarea, useToast } from '../ui';
import { getApiErrorMessage } from '../../lib/apiError';
import type { Scope } from '../../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  scopeId: number;
  scopeName?: string;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function validateFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(fileExtension(file.name) as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
    return `Only ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} files are allowed.`;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'File must be 100MB or smaller.';
  }
  return null;
}

export default function FileUploadModal({ open, onClose, scope, scopeId, scopeName }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const uploadMut = useUploadDocument();
  const toast = useToast();

  const reset = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setError('');
    setDragActive(false);
  };

  const onPickFile = (f: File | null | undefined) => {
    if (!f) return;
    const v = validateFile(f);
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setFile(f);
    if (!title) setTitle(f.name.replace(fileExtension(f.name), ''));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    onPickFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async () => {
    setError('');
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    try {
      await uploadMut.mutateAsync({ scope, scopeId, input: { title, description, file } });
      toast.success(`Uploaded "${title}".`);
      reset();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Upload file"
      subtitle={scopeName ? `Goes into the ${scopeName} repository.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={uploadMut.isPending}
            disabled={!file}
          >
            Upload
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="login-form__error"><span>{error}</span></div>}

        <div
          className={`file-dropzone ${dragActive ? 'file-dropzone--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 22V8M9 14l7-7 7 7" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 22v3a3 3 0 003 3h16a3 3 0 003-3v-3" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="file-dropzone__title">{file ? file.name : 'Drag a file here, or click to browse'}</p>
          <p className="file-dropzone__hint">
            {ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} · max 100MB
          </p>
          <label className="file-dropzone__btn">
            Choose file
            <input
              type="file"
              accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onPickFile(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="What is this document?"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional context for readers."
          />
        </Field>
      </div>
    </Modal>
  );
}
