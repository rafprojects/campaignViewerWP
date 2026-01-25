export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'other';
  source: 'upload' | 'external';
  provider?: string;
  url: string;
  embedUrl?: string;
  thumbnail?: string;
  caption?: string;
  order?: number;
}

export interface UploadResponse {
  attachmentId: string;
  url: string;
  thumbnail?: string;
  mimeType?: string;
}

const API_BASE = '/wp-json/wp-super-gallery/v1';

export async function getCampaignMedia(campaignId: string): Promise<MediaItem[]> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/media`);
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  return res.json();
}

export function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/media/upload`);
    xhr.responseType = 'json';

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Some servers may return JSON-parsed response in xhr.response
        resolve(xhr.response as UploadResponse);
      } else {
        const text = xhr.responseText || '';
        reject(new Error(`Upload failed: ${xhr.status} ${text}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
    }

    xhr.send(form);
  });
}

export async function addMediaToCampaign(campaignId: string, payload: Partial<MediaItem>) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Add media failed: ${res.status}`);
  return res.json();
}

export async function updateMedia(campaignId: string, mediaId: string, patch: Partial<MediaItem>) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/media/${mediaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update media failed: ${res.status}`);
  return res.json();
}

export async function deleteMedia(campaignId: string, mediaId: string) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/media/${mediaId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete media failed: ${res.status}`);
  return res.json();
}

export async function reorderMedia(campaignId: string, items: { id: string; order: number }[]) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/media/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Reorder media failed: ${res.status}`);
  return res.json();
}

export async function getOEmbed(url: string) {
  const res = await fetch(`${API_BASE}/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`oEmbed fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}
