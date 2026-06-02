import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--navy-950)',
            padding: '2rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <div className="ui-card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <h2 className="ui-card__title" style={{ justifyContent: 'center' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {this.state.error.message}
            </p>
            <button
              className="ui-btn ui-btn--primary"
              onClick={() => {
                this.reset();
                window.location.href = '/';
              }}
            >
              Reload OrgHub
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
