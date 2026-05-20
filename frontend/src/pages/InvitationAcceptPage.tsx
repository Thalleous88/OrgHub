import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAcceptInvitation } from '../hooks/queries/useInvitations';
import { Button } from '../components/ui';
import { getApiErrorMessage } from '../lib/apiError';
import './LoginPage.css';

export default function InvitationAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const acceptMut = useAcceptInvitation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
    }
  }, [token]);

  const handleAccept = async () => {
    setError('');
    try {
      await acceptMut.mutateAsync(token);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not accept the invitation.'));
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero__content animate-fade-in-up">
          <div className="login-hero__logo">
            <div className="login-hero__logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="url(#inv-logo-grad)" />
                <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="inv-logo-grad" x1="0" y1="0" x2="28" y2="28">
                    <stop stopColor="#14b8a6" />
                    <stop offset="1" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="login-hero__logo-text">OrgHub</span>
          </div>

          <h1 className="login-hero__title">
            You've been{' '}
            <span className="gradient-text">invited.</span>
          </h1>

          <p className="login-hero__subtitle">
            Accept your invitation to join an organization, division, or project on OrgHub.
          </p>
        </div>
        <div className="login-hero__decor">
          <div className="login-hero__orb login-hero__orb--1"></div>
          <div className="login-hero__orb login-hero__orb--2"></div>
          <div className="login-hero__grid-pattern"></div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card animate-fade-in">
          <div className="login-card__badge">
            <span>INVITATION</span>
          </div>
          <h2 className="login-card__title">
            {success ? 'Welcome aboard!' : 'Accept invitation'}
          </h2>
          <p className="login-card__subtitle">
            {success
              ? 'You now have access. Redirecting to your dashboard...'
              : 'Confirm to join your team. You must be signed in with the same email this invite was sent to.'}
          </p>

          {error && (
            <div className="login-form__error animate-fade-in" style={{ marginBottom: '1rem' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 10.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !isAuthenticated ? (
            <Button
              variant="primary"
              fullWidth
              onClick={() =>
                navigate(`/?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}`)
              }
            >
              Sign in to continue
            </Button>
          ) : !success ? (
            <Button
              variant="primary"
              fullWidth
              loading={acceptMut.isPending}
              disabled={!token}
              onClick={handleAccept}
            >
              Accept invitation
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
