import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ui.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size, footer, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

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

  const sizeClass = size === 'lg' ? 'ui-modal--lg' : size === 'xl' ? 'ui-modal--xl' : '';

  return createPortal(
    <div
      className="ui-modal__backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`ui-modal ${sizeClass}`} ref={ref} role="dialog" aria-modal="true">
        {(title || subtitle) && (
          <div className="ui-modal__header">
            <div>
              {title && <h2 className="ui-modal__title">{title}</h2>}
              {subtitle && <p className="ui-modal__subtitle">{subtitle}</p>}
            </div>
            <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
