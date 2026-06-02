import { apiBaseUrl, request, getAccessToken } from '../lib/fetcher';
import type { ResourceDocument, Scope } from '../types/api';

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.docx', '.xlsx', '.pptx', '.pdf'] as const;
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

export async function listScopeDocuments(
  scope: Scope,
  scopeId: number,
): Promise<ResourceDocument[]> {
  return request<ResourceDocument[]>(`/${scope}/${scopeId}/documents/`);
}

export async function uploadScopeDocument(
  scope: Scope,
  scopeId: number,
  input: { title: string; description?: string; file: File },
): Promise<ResourceDocument> {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.description) formData.append('description', input.description);
  formData.append('file', input.file);
  return request<ResourceDocument>(`/${scope}/${scopeId}/documents/`, {
    method: 'POST',
    formData,
  });
}

export async function deleteDocument(id: number): Promise<void> {
  await request<null>(`/documents/${id}/`, {
    method: 'DELETE',
    expectNoContent: true,
  });
}

/**
 * Trigger a browser download for a protected document. The endpoint requires JWT,
 * so we fetch as a blob then use an object URL.
 */
export async function downloadDocument(id: number, filename: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}/documents/${id}/download/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
