import { useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, Button, Spinner, EmptyState, Select, Field } from '../../components/ui';
import AnnouncementsList from '../../components/announcements/AnnouncementsList';
import CreateAnnouncementModal from '../../components/announcements/CreateAnnouncementModal';
import { useAnnouncementFeed } from '../../hooks/queries/useAnnouncements';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getApiErrorMessage } from '../../lib/apiError';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { isCoreBoard } = useWorkspace();
  const { data: announcements, isLoading, isError, error, refetch } = useAnnouncementFeed();

  const memberships = user?.memberships;

  const adminOrgs = useMemo(
    () => (memberships?.organizations ?? []).filter((o) => o.role === 'CORE_BOARD'),
    [memberships],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [postOrgId, setPostOrgId] = useState<number | undefined>(adminOrgs[0]?.id);

  const filtered = useMemo(() => {
    if (!announcements) return [];
    if (orgFilter === 'all') return announcements;
    const id = Number(orgFilter);
    return announcements.filter((a) => a.organization === id);
  }, [announcements, orgFilter]);

  const allOrgs = memberships?.organizations ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Announcements"
        subtitle="Updates from the organizations you belong to."
        actions={
          adminOrgs.length > 0 ? (
            <Button onClick={() => setCreateOpen(true)}>Post announcement</Button>
          ) : null
        }
      />

      {allOrgs.length > 1 && (
        <div style={{ maxWidth: 320, marginBottom: '1.5rem' }}>
          <Field label="Filter by organization">
            <Select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
              <option value="all">All organizations</option>
              {allOrgs.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {isLoading ? (
        <Spinner label="Loading announcements..." />
      ) : isError ? (
        <EmptyState
          title="Could not load announcements"
          description={getApiErrorMessage(error, 'Try again in a moment.')}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <AnnouncementsList
          announcements={filtered}
          canManage={(a) => isCoreBoard(a.organization)}
        />
      )}

      {adminOrgs.length > 0 && (
        <>
          {adminOrgs.length > 1 && createOpen && (
            <div style={{ maxWidth: 320, margin: '1rem 0' }}>
              <Field label="Post to organization">
                <Select
                  value={postOrgId !== undefined ? String(postOrgId) : ''}
                  onChange={(e) => setPostOrgId(Number(e.target.value))}
                >
                  {adminOrgs.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <CreateAnnouncementModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            organizationId={postOrgId ?? adminOrgs[0]?.id}
            organizationName={adminOrgs.find((o) => o.id === (postOrgId ?? adminOrgs[0]?.id))?.name}
          />
        </>
      )}
    </AppShell>
  );
}
