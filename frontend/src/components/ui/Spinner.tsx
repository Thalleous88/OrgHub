import './ui.css';

interface SpinnerProps {
  size?: 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className="ui-section-loader" role="status" aria-live="polite">
      <div className={`ui-spinner ${size === 'lg' ? 'ui-spinner--lg' : ''}`} />
      {label && <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</span>}
    </div>
  );
}
