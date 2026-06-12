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

export type RembgMeta = {
  configured_model: string;
  loaded_model: string | null;
  preserve_detail: boolean;
  mask_dilate: number;
  alpha_matting: boolean;
  foreground_threshold: number;
  background_threshold: number;
  erode_size: number;
  min_dimension: number;
};

export type ProcessingMeta = {
  processed_at?: string;
  rembg?: RembgMeta;
  subject_fill_ratio?: number;
  background_id?: string | null;
  watermark?: {
    enabled?: boolean;
    scale?: number;
    opacity?: number;
    bottom_margin_px?: number;
  };
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
  processing_meta?: ProcessingMeta | null;
  adjusted_key?: string | null;
  adjustments?: { transform?: AdjustTransform; mask_key?: string | null; updated_at?: string } | null;
};

export type AdjustTransform = {
  scale: number;
  offset_x: number;
  offset_y: number;
  rotation: number;
  flip_h: boolean;
  flip_v: boolean;
};

export const DEFAULT_TRANSFORM: AdjustTransform = {
  scale: 1,
  offset_x: 0,
  offset_y: 0,
  rotation: 0,
  flip_h: false,
  flip_v: false,
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
  rembg_model: string;
  rembg_preserve_detail: boolean;
  rembg_mask_dilate: number;
  rembg_alpha_matting: boolean;
  rembg_foreground_threshold: number;
  rembg_background_threshold: number;
  rembg_erode_size: number;
  rembg_min_dimension: number;
  // Cutout engine (null = inherit env baseline)
  cutout_engine?: string | null;
  processing_mode?: string | null;
  quality_mode?: string | null;
  managed_api_enabled?: boolean | null;
  managed_api_provider?: string | null;
  hybrid_escalate_below?: number | null;
  // Output renditions (null = inherit env baseline)
  render_master_png?: boolean | null;
  render_master_webp?: boolean | null;
  render_web_webp?: boolean | null;
  render_web_avif?: boolean | null;
  render_branded_jpeg?: boolean | null;
  master_max_dimension?: number | null;
  web_max_dimension?: number | null;
  webp_quality?: number | null;
  avif_quality?: number | null;
  updated_at: string;
};

export const CUTOUT_ENGINE_OPTIONS = [
  { id: 'self_hosted', label: 'Self-hosted (local)' },
  { id: 'managed_api', label: 'Managed API' },
  { id: 'hybrid', label: 'Hybrid (local + escalate)' },
] as const;

export const PROCESSING_MODE_OPTIONS = [
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU (future)' },
] as const;

export const QUALITY_MODE_OPTIONS = [
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'premium', label: 'Premium' },
] as const;

export const MANAGED_PROVIDER_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'photoroom', label: 'Photoroom' },
  { id: 'removebg', label: 'remove.bg' },
] as const;

export const COMPARE_MODES = ['balanced', 'premium', 'hybrid'] as const;

export type CutoutPreviewResult = {
  mode?: string;
  engine: string;
  processing_mode: string;
  quality: string;
  provider: string;
  model: string | null;
  confidence: number;
  escalated: boolean;
  elapsed_ms: number;
  cutout_base64: string;
  branded_base64?: string;
  meta?: Record<string, unknown>;
  error?: string;
};

/** Strongest → lightest (best chandelier detail first). */
export const REMBG_MODEL_OPTIONS = [
  { rank: 1, id: 'birefnet-general' },
  { rank: 2, id: 'bria-rmbg' },
  { rank: 3, id: 'isnet-general-use' },
  { rank: 4, id: 'u2net' },
] as const;

export const REMBG_MODELS = REMBG_MODEL_OPTIONS.map((m) => m.id);

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
  preserve_detail: boolean;
  mask_dilate: number;
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

export type RuntimeCutoutInfo = {
  engine: string;
  processing_mode: string;
  quality: string;
  managed_api_enabled: boolean;
  managed_api_provider: string;
  managed_api_key_set: boolean;
  pymatting_available: boolean;
  renditions: {
    master_png: boolean;
    master_webp: boolean;
    web_webp: boolean;
    web_avif: boolean;
  };
};

export type RuntimeInfo = {
  output_width: number;
  output_height: number;
  deploy: RuntimeDeployInfo;
  libraries: RuntimeLibraries;
  rembg: RuntimeRembgInfo;
  cutout?: RuntimeCutoutInfo;
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
  rendition_urls?: Record<string, string> | null;
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

export async function resumeBatchProcessing(batchId: string) {
  return request<{ ok: boolean; batch_id: string; status: string }>(
    `/api/v1/batches/${batchId}/process`,
    { method: 'POST' },
  );
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

export async function getItem(itemId: string) {
  return request<{ item: BatchItem }>(`/api/v1/items/${itemId}`);
}

export async function adjustItem(
  itemId: string,
  payload: { transform: AdjustTransform; mask_base64?: string | null; clear_mask?: boolean },
) {
  return request<{ item: BatchItem }>(`/api/v1/items/${itemId}/adjust`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function resetItemAdjustments(itemId: string) {
  return request<{ item: BatchItem }>(`/api/v1/items/${itemId}/adjust/reset`, { method: 'POST' });
}

export async function reprocessItem(itemId: string) {
  return request<{ ok: boolean }>(`/api/v1/items/${itemId}/reprocess`, { method: 'POST' });
}

export async function previewRembg(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(apiUrl('/api/v1/settings/rembg/preview'), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    preview_base64: string;
    settings: Record<string, unknown>;
    loaded_model: string | null;
  }>;
}

export type ProgressItem = {
  item_id: string;
  name: string;
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  stage_label: string;
  percent: number;
  elapsed_ms: number | null;
  error: string | null;
};

export type BatchProgress = {
  batch_id: string;
  active: boolean;
  total: number;
  completed: number;
  failed: number;
  overall_percent: number;
  elapsed_ms: number | null;
  eta_ms: number | null;
  current: { item_id: string; name: string; index: number; stage: string; stage_label: string } | null;
  items: ProgressItem[];
};

export type Preset = {
  id: string;
  label: string;
  quality: string;
  engine: string;
  renditions: Record<string, boolean>;
};

export async function getBatchProgress(batchId: string) {
  return request<BatchProgress>(`/api/v1/batches/${batchId}/progress`);
}

export async function retryItem(itemId: string) {
  return request<{ ok: boolean; batch_id: string }>(`/api/v1/items/${itemId}/retry`, { method: 'POST' });
}

export async function listPresets() {
  return request<{ presets: Preset[] }>('/api/v1/presets');
}

export async function importImages(
  files: File[],
  opts?: { batchName?: string; preset?: string; quality?: string; purpose?: string; autoProcess?: boolean },
) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const query = new URLSearchParams({ auto_process: String(opts?.autoProcess ?? true) });
  if (opts?.batchName) query.set('batch_name', opts.batchName);
  if (opts?.preset) query.set('preset', opts.preset);
  if (opts?.quality) query.set('quality', opts.quality);
  if (opts?.purpose) query.set('purpose', opts.purpose);
  const res = await fetch(apiUrl(`/api/v1/import/local?${query}`), { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ batch_id: string; item_count: number }>;
}

export async function cutoutPreview(
  file: File,
  overrides?: {
    engine?: string;
    quality?: string;
    processing_mode?: string;
    managed_api_enabled?: boolean;
    branded?: boolean;
  },
) {
  const form = new FormData();
  form.append('file', file);
  if (overrides?.engine) form.append('engine', overrides.engine);
  if (overrides?.quality) form.append('quality', overrides.quality);
  if (overrides?.processing_mode) form.append('processing_mode', overrides.processing_mode);
  if (overrides?.managed_api_enabled !== undefined)
    form.append('managed_api_enabled', String(overrides.managed_api_enabled));
  form.append('branded', String(overrides?.branded ?? false));
  const res = await fetch(apiUrl('/api/v1/cutout/preview'), { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CutoutPreviewResult>;
}

export async function cutoutCompare(file: File, modes: string[], branded = true) {
  const form = new FormData();
  form.append('file', file);
  form.append('modes', modes.join(','));
  form.append('branded', String(branded));
  const res = await fetch(apiUrl('/api/v1/cutout/compare'), { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ results: CutoutPreviewResult[] }>;
}

export async function generateRenditions(itemId: string) {
  return request<{ item_id: string; renditions: Record<string, string> }>(
    `/api/v1/items/${itemId}/renditions`,
    { method: 'POST' },
  );
}

export async function applyItemProcessingSettings(itemId: string) {
  return request<SettingsResponse>(`/api/v1/items/${itemId}/apply-processing-settings`, {
    method: 'POST',
  });
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
