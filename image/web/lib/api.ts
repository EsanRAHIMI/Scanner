import { getImageApiBase } from '@/lib/env';

export type BatchStatus =
  | 'draft'
  | 'processing'
  | 'review'
  | 'background'
  | 'finalized'
  | 'failed';

export type ItemStatus =
  | 'imported'
  | 'processing'
  | 'processed'
  | 'reviewed'
  | 'background_applied'
  | 'finalized'
  | 'failed';

export type Batch = {
  id: string;
  name: string;
  source: 'local' | 's3' | 'google_drive';
  status: BatchStatus;
  default_background_id: string;
  created_at: string;
  updated_at: string;
};

export type BatchItem = {
  id: string;
  batch_id: string;
  file_name: string;
  display_name: string;
  source_ref: string;
  original_key: string;
  processed_key: string | null;
  final_key: string | null;
  original_url: string | null;
  processed_url: string | null;
  final_url: string | null;
  background_id: string | null;
  status: ItemStatus;
  error: string | null;
};

export type Background = {
  id: string;
  name: string;
  is_default: boolean;
  preview_url?: string;
};

export type SystemSettings = {
  default_background_id: string;
  auto_process_on_import: boolean;
  subject_fill_ratio: number;
  watermark_enabled: boolean;
  watermark_scale: number;
  watermark_opacity: number;
  watermark_bottom_margin_px: number;
  updated_at: string;
};

export type WatermarkInfo = {
  preview_url: string;
  configured: boolean;
  name: string;
  updated_at?: string | null;
};

export type RuntimeDeployInfo = {
  hostname: string;
  in_container: boolean;
  python_version: string;
  platform: string;
  executable: string;
};

export type RuntimeLibraries = {
  rembg: string | null;
  pillow: string | null;
  onnxruntime: string | null;
  numpy: string | null;
  pymongo: string | null;
  fastapi: string | null;
  boto3: string | null;
};

export type RuntimeRembgInfo = {
  configured_model: string;
  loaded_model: string | null;
  alpha_matting: boolean;
  foreground_threshold: number;
  background_threshold: number;
  erode_size: number;
  max_dimension: number;
  min_dimension: number;
  onnx_providers: string[];
  available: boolean;
};

export type RuntimeStorageInfo = {
  s3_enabled: boolean;
  s3_bucket: string | null;
  s3_region: string;
  s3_public_base_url: string | null;
  upload_prefix: string;
  processed_prefix: string;
  final_prefix: string;
  backgrounds_prefix: string;
  watermarks_prefix: string;
  local_storage_root: string;
};

export type RuntimeMongoInfo = {
  enabled: boolean;
  ok: boolean;
  db: string;
};

export type RuntimeInfo = {
  output_width: number;
  output_height: number;
  deploy: RuntimeDeployInfo;
  libraries: RuntimeLibraries;
  rembg: RuntimeRembgInfo;
  storage: RuntimeStorageInfo;
  mongodb: RuntimeMongoInfo;
  google_drive_configured: boolean;
  // Legacy flat fields (optional)
  s3_enabled?: boolean;
  s3_bucket?: string | null;
  upload_prefix?: string;
  processed_prefix?: string;
  final_prefix?: string;
};

export type SettingsResponse = {
  settings: SystemSettings;
  backgrounds: Background[];
  watermark: WatermarkInfo;
  runtime: RuntimeInfo;
};

export type OutputRow = {
  id: string;
  batch_id: string;
  file_name: string;
  final_url: string;
  source_ref: string;
  original_ref: string;
  source: string;
  status: ItemStatus;
  background_id?: string | null;
  updated_at: string;
};

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Production: Web at / and Image API at /api/v1 on the same host (image.lorenzohome.ae).
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return normalized;
  }
  const base = getImageApiBase();
  return `${base}${normalized}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/v1/')) return apiUrl(url);
  return apiUrl(`/api/v1/${url.replace(/^\/+/, '')}`);
}

export async function listBatches() {
  return request<{ batches: Batch[] }>('/api/v1/batches');
}

export async function getBatch(batchId: string) {
  return request<{ batch: Batch; items: BatchItem[] }>(`/api/v1/batches/${batchId}`);
}

export async function listBackgrounds() {
  return request<{ backgrounds: Background[] }>('/api/v1/backgrounds');
}

export async function getSettings() {
  return request<SettingsResponse>('/api/v1/settings');
}

export async function updateSettings(payload: Partial<SystemSettings>) {
  return request<SettingsResponse>('/api/v1/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function uploadWatermark(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(apiUrl('/api/v1/settings/watermark'), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SettingsResponse>;
}

export async function resetWatermark() {
  return request<SettingsResponse>('/api/v1/settings/watermark/reset', { method: 'POST' });
}

export async function uploadBackground(file: File, options?: { backgroundId?: string; displayName?: string }) {
  const form = new FormData();
  form.append('file', file);
  const query = new URLSearchParams();
  if (options?.backgroundId) query.set('background_id', options.backgroundId);
  if (options?.displayName) query.set('display_name', options.displayName);
  const suffix = query.toString() ? `?${query}` : '';
  const res = await fetch(apiUrl(`/api/v1/settings/backgrounds${suffix}`), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ background: Background; backgrounds: Background[] }>;
}

export async function importLocal(files: File[], batchName?: string) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const query = new URLSearchParams({ auto_process: 'true' });
  if (batchName) query.set('batch_name', batchName);
  const res = await fetch(apiUrl(`/api/v1/import/local?${query}`), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ batch_id: string; item_count: number }>;
}

export async function importS3(payload: { keys?: string[]; prefix?: string; batch_name?: string }) {
  return request<{ batch_id: string; item_count: number }>('/api/v1/import/s3', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function importGoogleDrive(payload: {
  file_ids?: string[];
  folder_id?: string;
  batch_name?: string;
}) {
  return request<{ batch_id: string; item_count: number }>('/api/v1/import/google-drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function renameItem(itemId: string, displayName: string) {
  return request<{ item: BatchItem }>(`/api/v1/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function reprocessItem(itemId: string) {
  return request<{ ok: boolean }>(`/api/v1/items/${itemId}/reprocess`, { method: 'POST' });
}

export async function applyBackground(
  batchId: string,
  payload: { default_background_id?: string; overrides?: Record<string, string> },
) {
  return request<{ batch: Batch; items: BatchItem[] }>(
    `/api/v1/batches/${batchId}/apply-background`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function finalizeBatch(batchId: string) {
  return request<{ batch: Batch; outputs: OutputRow[] }>(`/api/v1/batches/${batchId}/finalize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
}

export async function listOutputs(params?: {
  batch_id?: string;
  file_name?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.batch_id) query.set('batch_id', params.batch_id);
  if (params?.file_name) query.set('file_name', params.file_name);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query}` : '';
  return request<{ items: OutputRow[]; total: number; has_more: boolean }>(
    `/api/v1/outputs${suffix}`,
  );
}

export async function changeOutputBackground(itemId: string, backgroundId: string) {
  return request<{ output: OutputRow }>(`/api/v1/outputs/${itemId}/background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ background_id: backgroundId }),
  });
}

export async function deleteOutput(itemId: string) {
  return request<{ ok: boolean; id: string }>(`/api/v1/outputs/${itemId}`, {
    method: 'DELETE',
  });
}
