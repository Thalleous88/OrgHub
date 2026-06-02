import { useState } from 'react';
import { Modal, Badge, Button } from '../ui';
import type { Announcement, AnnouncementPriority } from '../../types/api';
import { useDeleteAnnouncement } from '../../hooks/queries/useAnnouncements';

interface Props {
  open: boolean;
  announcement: Announcement | null;
  canManage?: boolean;
  onClose: () => void;
}

const priorityVariant: Record<AnnouncementPriority, 'teal' | 'amber' | 'red' | 'neutral'> = {
  LOW: 'neutral',
  NORMAL: 'teal',
  HIGH: 'red',
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default function AnnouncementDetailModal({ open, announcement, canManage, onClose }: Props) {
  const deleteMut = useDeleteAnnouncement();

  if (!announcement) return null;

  const handleDelete = () => {
    if (window.confirm(`Delete announcement "${announcement.title}"?`)) {
      deleteMut.mutate(announcement.id, { onSuccess: onClose });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={announcement.title}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Badge variant={priorityVariant[announcement.priority]}>{announcement.priority}</Badge>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            By {announcement.created_by_email.split('@')[0]} · {formatDate(announcement.created_at)}
          </span>
        </span>
      }
      footer={
        canManage ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="danger" size="sm" loading={deleteMut.isPending} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        {announcement.content}
      </p>
    </Modal>
  );
}
