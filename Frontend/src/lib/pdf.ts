import { apiClient } from '../api/client'

/** Fetches a PDF through the authenticated API client (a plain <a href>
 * can't carry the JWT header) and opens it in a new tab via a blob URL -
 * the browser's own viewer then handles print / save-as-PDF from there. */
export async function openPdf(path: string): Promise<void> {
  const resp = await apiClient.get(path, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(resp.data as Blob)
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
