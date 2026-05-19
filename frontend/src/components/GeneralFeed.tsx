import type { DashboardAnnouncement } from '../services/api';
import './GeneralFeed.css';

interface GeneralFeedProps {
  announcements: DashboardAnnouncement[];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'HIGH':
      return <span className="feed-priority feed-priority--high">HIGH</span>;
    case 'NORMAL':
      return <span className="feed-priority feed-priority--normal">NORMAL</span>;
    case 'LOW':
      return <span className="feed-priority feed-priority--low">LOW</span>;
    default:
      return null;
  }
}

function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

export default function GeneralFeed({ announcements }: GeneralFeedProps) {
  const sortedAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="general-feed animate-fade-in-up delay-5" id="feed-widget">
      <h3 className="general-feed__title">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 5a2 2 0 012-2h8a2 2 0 012 2v7a2 2 0 01-2 2H8l-3 2v-2H5a2 2 0 01-2-2V5z" stroke="var(--teal-400)" strokeWidth="1.5"/>
          <path d="M7 7h4M7 10h2" stroke="var(--teal-400)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        General Feed
      </h3>

      {sortedAnnouncements.length === 0 ? (
        <div className="general-feed__empty">
          <p>No announcements yet</p>
        </div>
      ) : (
        <div className="general-feed__list">
          {sortedAnnouncements.map((ann) => (
            <div key={ann.id} className="feed-item">
              <div className="feed-item__avatar">
                {getInitials(ann.created_by_email)}
              </div>
              <div className="feed-item__content">
                <div className="feed-item__header">
                  <span className="feed-item__author">
                    {ann.created_by_email.split('@')[0]}
                  </span>
                  {getPriorityBadge(ann.priority)}
                  <span className="feed-item__time">{timeAgo(ann.created_at)}</span>
                </div>
                <h4 className="feed-item__title">{ann.title}</h4>
                <p className="feed-item__text">{ann.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {announcements.length > 5 && (
        <button className="general-feed__view-all" id="view-all-broadcasts">
          View All Broadcasts
        </button>
      )}
    </div>
  );
}
