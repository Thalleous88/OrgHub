import type { ReactNode } from 'react';
import './ui.css';

interface BadgeProps {
  variant?: 'teal' | 'amber' | 'red' | 'neutral';
  children: ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${variant}`}>{children}</span>;
}
