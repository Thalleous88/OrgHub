import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

export interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="breadcrumbs__item">
            {item.to && !isLast ? (
              <Link className="breadcrumbs__link" to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span className={`breadcrumbs__current ${isLast ? 'breadcrumbs__current--active' : ''}`}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <svg className="breadcrumbs__sep" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        );
      })}
    </nav>
  );
}
