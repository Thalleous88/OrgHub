import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Tabs,
  Select,
  Field,
  Input,
} from '../../components/ui';
import FileList from '../../components/files/FileList';
import FileUploadModal from '../../components/files/FileUploadModal';
import { useScopeDocuments } from '../../hooks/queries/useDocuments';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { Scope } from '../../types/api';

type TabKey = 'organizations' | 'divisions' | 'projects';

export default function FilesPage() {
  const { memberships, canManageDivision, canManageProject, isCoreBoard } = useWorkspace();
  const [tab, setTab] = useState<TabKey>(() => {
    if (memberships.organizations.length > 0) return 'organizations';
    if (memberships.divisions.length > 0) return 'divisions';
    return 'projects';
  });
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const scopeOptions = useMemo(() => {
    if (tab === 'organizations') {
      return memberships.organizations.map((o) => ({ value: o.id, label: o.name }));
    }
    if (tab === 'divisions') {
      return memberships.divisions.map((d) => ({ value: d.id, label: d.name }));
    }
    return memberships.projects.map((p) => ({ value: p.id, label: p.name }));
  }, [tab, memberships]);

  const [scopeId, setScopeId] = useState<number | undefined>(scopeOptions[0]?.value);

  // Reset scopeId when tab changes.
  useEffect(() => {
    setScopeId(scopeOptions[0]?.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const scope: Scope = tab;
  const { data: documents = [], isLoading } = useScopeDocuments(scope, scopeId);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q),
    );
  }, [documents, search]);

  // Decide if the user can manage uploads/deletes for the selected scope.
  const canManage = useMemo(() => {
    if (!scopeId) return false;
    if (tab === 'organizations') {
      return isCoreBoard(scopeId);
    }
    if (tab === 'divisions') {
      const div = memberships.divisions.find((d) => d.id === scopeId);
      if (!div) return false;
      return canManageDivision(div.organization_id, div.id);
    }
    const proj = memberships.projects.find((p) => p.id === scopeId);
    if (!proj) return false;
    const div = memberships.divisions.find((d) => d.id === proj.division_id);
    if (!div) return false;
    return canManageProject(div.organization_id, div.id, proj.id);
  }, [tab, scopeId, memberships, isCoreBoard, canManageDivision, canManageProject]);

  const scopeLabel =
    scopeOptions.find((s) => s.value === scopeId)?.label ?? 'Select a scope';

  return (
    <AppShell>
      <PageHeader
        title="Files"
        subtitle="Browse and manage documents shared across your organizations, divisions, and projects."
        actions={
          canManage && scopeId ? (
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              Upload file
            </Button>
          ) : undefined
        }
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: 'organizations', label: `Organizations (${memberships.organizations.length})` },
          { key: 'divisions', label: `Divisions (${memberships.divisions.length})` },
          { key: 'projects', label: `Projects (${memberships.projects.length})` },
        ]}
      />

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <Field label={`${tab[0].toUpperCase()}${tab.slice(1, -1)} repository`}>
            <Select
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(Number(e.target.value))}
              disabled={scopeOptions.length === 0}
            >
              {scopeOptions.length === 0 ? (
                <option value="">No memberships</option>
              ) : (
                scopeOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))
              )}
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Field label="Search">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title or description"
            />
          </Field>
        </div>
      </div>

      {scopeOptions.length === 0 ? (
        <EmptyState
          title="No accessible repositories"
          description="You don't belong to any scopes of this type yet."
        />
      ) : isLoading ? (
        <Spinner />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          title="No files here"
          description={
            search
              ? 'No documents match your search.'
              : canManage
              ? 'Upload a document to seed this repository.'
              : 'Documents uploaded by managers will appear here.'
          }
          action={canManage && !search ? (
            <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>Upload file</Button>
          ) : undefined}
        />
      ) : (
        <FileList documents={filteredDocs} canDelete={() => canManage} />
      )}

      {scopeId && (
        <FileUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          scope={scope}
          scopeId={scopeId}
          scopeName={scopeLabel}
        />
      )}
    </AppShell>
  );
}
