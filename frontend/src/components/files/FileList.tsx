import { useToast } from '../ui';
import { useDeleteDocument } from '../../hooks/queries/useDocuments';
import { downloadDocument } from '../../services/documents';
import { getApiErrorMessage } from '../../lib/apiError';
import type { ResourceDocument } from '../../types/api';
import './Files.css';

interface Props {
  documents: ResourceDocument[];
  canDelete?: (doc: ResourceDocument) => boolean;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx >= 0 ? filePath.slice(idx + 1).toUpperCase() : 'FILE';
}

function getFilename(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.slice(idx + 1) : filePath;
}

export default function FileList({ documents, canDelete }: Props) {
  const toast = useToast();
  const deleteMut = useDeleteDocument();

  const handleDownload = async (doc: ResourceDocument) => {
    try {
      await downloadDocument(doc.id, getFilename(doc.file));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Download failed.'));
    }
  };

  const handleDelete = async (doc: ResourceDocument) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    try {
      await deleteMut.mutateAsync(doc.id);
      toast.success('File deleted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Delete failed.'));
    }
  };

  return (
    <div className="files-list">
      {documents.map((doc) => (
        <div key={doc.id} className="file-item">
          <div className="file-item__head">
            <div className="file-item__icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M14 2v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 4a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="ui-badge ui-badge--neutral" style={{ fontSize: '0.65rem' }}>
              {getExtension(doc.file)}
            </span>
          </div>
          <h4 className="file-item__title">{doc.title}</h4>
          {doc.description && <p className="file-item__desc">{doc.description}</p>}
          <div className="file-item__meta">
            <span>
              {doc.uploaded_by_email?.split('@')[0]} · {fmtDate(doc.created_at)}
            </span>
            <div className="file-item__actions">
              <button
                type="button"
                className="file-item__action"
                aria-label="Download"
                onClick={() => handleDownload(doc)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v8M3 7l4 4 4-4M2 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {canDelete?.(doc) && (
                <button
                  type="button"
                  className="file-item__action file-item__action--danger"
                  aria-label="Delete"
                  onClick={() => handleDelete(doc)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 4h10M5 4V2.5A1 1 0 016 1.5h2a1 1 0 011 1V4M3 4l1 8a1 1 0 001 1h4a1 1 0 001-1l1-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
