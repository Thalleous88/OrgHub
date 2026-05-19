import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ui.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({ open, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="ui-drawer__backdrop" onClick={onClose} />
      <aside className="ui-drawer" role="dialog" aria-modal="true">
        {children}
      </aside>
    </>,
    document.body,
  );
}
