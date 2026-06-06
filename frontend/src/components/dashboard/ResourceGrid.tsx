import type { ReactElement } from 'react';
import type { ResourceDocument } from '../../types/api';
import './ResourceGrid.css';

interface ResourceGridProps {
  documents: ResourceDocument[];
}

const scopeIcons: Record<string, ReactElement> = {
  organizations: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  divisions: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M14 17h6M17 14v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  projects: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const defaultIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M14 3v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function getScopeLabel(scope: string): string {
  switch (scope) {
    case 'organizations': return 'Organization';
    case 'divisions': return 'Division';
    case 'projects': return 'Project';
    default: return 'Resource';
  }
}

export default function ResourceGrid({ documents }: ResourceGridProps) {
  const displayDocs = documents.slice(0, 6);

  return (
    <div className="resource-grid animate-fade-in-up delay-4" id="resource-widget">
      <h3 className="resource-grid__title">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4a2 2 0 012-2h4l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="var(--teal-400)" strokeWidth="1.5"/>
        </svg>
        Division Resources
      </h3>

      {displayDocs.length === 0 ? (
        <div className="resource-grid__empty">
          <p>No resources available yet</p>
        </div>
      ) : (
        <div className="resource-grid__grid">
          {displayDocs.map((doc, i) => (
            <a
              key={doc.id}
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`resource-card glass-card-light delay-${i + 1}`}
              style={{ animationName: 'fadeIn', animationDuration: '0.4s', animationFillMode: 'both' }}
            >
              <div className="resource-card__icon">
                {scopeIcons[doc.repository_scope] || defaultIcon}
              </div>
              <h4 className="resource-card__name">{doc.title}</h4>
              <p className="resource-card__desc">
                {doc.description || `${getScopeLabel(doc.repository_scope)} document`}
              </p>
              <span className="resource-card__scope">{getScopeLabel(doc.repository_scope)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
