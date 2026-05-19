import type { ReactNode } from 'react';
import './ui.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      {icon}
      {title && <span className="ui-empty__title">{title}</span>}
      {description && <p className="ui-empty__desc">{description}</p>}
      {action}
    </div>
  );
}
