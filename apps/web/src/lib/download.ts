import { apiClient } from './api-client';

/**
 * Downloads a file via authenticated axios request (includes Bearer token),
 * then triggers a browser download. Use this instead of window.open() for
 * endpoints that require auth.
 */
export async function downloadAuthenticated(
  url: string,
  fallbackFilename = 'download',
): Promise<void> {
  const response = await apiClient.get(url, { responseType: 'blob' });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
