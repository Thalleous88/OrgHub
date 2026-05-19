import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginAction } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await loginAction(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Unable to connect to the server. Please ensure the backend is running.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Hero Panel */}
      <div className="login-hero">
        <div className="login-hero__content animate-fade-in-up">
          <div className="login-hero__logo">
            <div className="login-hero__logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="url(#logo-grad)" />
                <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                    <stop stopColor="#14b8a6" />
                    <stop offset="1" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="login-hero__logo-text">OrgHub</span>
          </div>

          <h1 className="login-hero__title">
            Empowering the next{' '}
            <span className="gradient-text">generation of leaders.</span>
          </h1>

          <p className="login-hero__subtitle">
            The central nervous system for your university organizations.
            Manage workflows, collaborate on projects, and lead with clarity.
          </p>

          <div className="login-hero__stats">
            <div className="login-hero__stat">
              <span className="login-hero__stat-number">500+</span>
              <span className="login-hero__stat-label">Active Members</span>
            </div>
            <div className="login-hero__stat">
              <span className="login-hero__stat-number">50+</span>
              <span className="login-hero__stat-label">Organizations</span>
            </div>
            <div className="login-hero__stat">
              <span className="login-hero__stat-number">1.2k</span>
              <span className="login-hero__stat-label">Tasks Completed</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="login-hero__decor">
          <div className="login-hero__orb login-hero__orb--1"></div>
          <div className="login-hero__orb login-hero__orb--2"></div>
          <div className="login-hero__grid-pattern"></div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="login-panel">
        <div className="login-card animate-fade-in">
          <div className="login-card__badge">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L8.5 4.5L12.5 5L9.5 7.5L10.5 11.5L7 9.5L3.5 11.5L4.5 7.5L1.5 5L5.5 4.5L7 1Z" fill="#14b8a6"/>
            </svg>
            <span>SECURED VIA JWT</span>
          </div>

          <h2 className="login-card__title">Welcome back</h2>
          <p className="login-card__subtitle">Log in to access your student workspace</p>

          <form onSubmit={handleSubmit} className="login-form" id="login-form">
            {error && (
              <div className="login-form__error animate-fade-in">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="login-form__group">
              <label htmlFor="email-input" className="login-form__label">UNIVERSITY EMAIL</label>
              <div className="login-form__input-wrapper">
                <svg className="login-form__input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="4" width="14" height="10" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                  <path d="M2 6l7 4 7-4" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                <input
                  id="email-input"
                  type="email"
                  placeholder="name@org.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="login-form__group">
              <label htmlFor="password-input" className="login-form__label">SECRET ACCESS KEY</label>
              <div className="login-form__input-wrapper">
                <svg className="login-form__input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="4" y="8" width="10" height="8" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                  <path d="M6 8V6a3 3 0 116 0v2" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="9" cy="12" r="1" fill="#64748b"/>
                </svg>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className="login-form__toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="#64748b" strokeWidth="1.5"/>
                      <circle cx="9" cy="9" r="2" stroke="#64748b" strokeWidth="1.5"/>
                      <path d="M3 3l12 12" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="#64748b" strokeWidth="1.5"/>
                      <circle cx="9" cy="9" r="2" stroke="#64748b" strokeWidth="1.5"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-form__submit"
              id="login-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="login-form__spinner"></span>
              ) : (
                <>
                  Sign In to Portal
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="login-card__help">
            Need technical help? <a href="#support">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
