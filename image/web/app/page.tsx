'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { importGoogleDrive, importLocal, importS3 } from '@/lib/api';

type SourceTab = 'local' | 's3' | 'google_drive';

export default function ImportPage() {
  const router = useRouter();
  const [tab, setTab] = useState<SourceTab>('local');
  const [batchName, setBatchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [s3Prefix, setS3Prefix] = useState('uploads/');
  const [s3Keys, setS3Keys] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveFileIds, setDriveFileIds] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function handleLocalSubmit(files: FileList | null) {
    if (!files?.length) {
      setError('Select at least one image or folder.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await importLocal(Array.from(files), batchName || undefined);
      router.push(`/batches/${result.batch_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleS3Submit() {
    setLoading(true);
    setError(null);
    try {
      const keys = s3Keys
        .split('\n')
        .map((k) => k.trim())
        .filter(Boolean);
      const result = await importS3({
        prefix: keys.length ? undefined : s3Prefix || undefined,
        keys: keys.length ? keys : undefined,
        batch_name: batchName || undefined,
      });
      router.push(`/batches/${result.batch_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'S3 import failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDriveSubmit() {
    setLoading(true);
    setError(null);
    try {
      const fileIds = driveFileIds
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
      const result = await importGoogleDrive({
        folder_id: driveFolderId || undefined,
        file_ids: fileIds.length ? fileIds : undefined,
        batch_name: batchName || undefined,
      });
      router.push(`/batches/${result.batch_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import images"
        description="Upload from local disk, Amazon S3, or Google Drive. Processing starts automatically with your default background."
      />

      <section className="dash-panel">
        <div className="dash-panel-body space-y-5">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-brand-black">Batch name (optional)</span>
            <input
              className="field-input max-w-md"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Spring catalog batch"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {(['local', 's3', 'google_drive'] as SourceTab[]).map((source) => (
              <button
                key={source}
                type="button"
                className={tab === source ? 'btn-segment-active' : 'btn-segment'}
                onClick={() => setTab(source)}
              >
                {source === 'local' ? 'Local drive' : source === 's3' ? 'Amazon S3' : 'Google Drive'}
              </button>
            ))}
          </div>

          {tab === 'local' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  void handleLocalSubmit(e.target.files);
                  e.target.value = '';
                }}
                disabled={loading}
              />
              <input
                ref={folderInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                // @ts-expect-error webkitdirectory is supported in Chromium
                webkitdirectory=""
                directory=""
                onChange={(e) => {
                  void handleLocalSubmit(e.target.files);
                  e.target.value = '';
                }}
                disabled={loading}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" disabled={loading} onClick={() => fileInputRef.current?.click()}>
                  Choose file(s)
                </button>
                <button type="button" className="btn-outline" disabled={loading} onClick={() => folderInputRef.current?.click()}>
                  Choose folder
                </button>
              </div>
              <p className="text-xs text-brand-medium-gray">
                Originals are stored under <code className="text-brand-dark-gray">uploads/</code> when S3 is configured.
              </p>
            </div>
          )}

          {tab === 's3' && (
            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">S3 prefix (folder import)</span>
                <input className="field-input" value={s3Prefix} onChange={(e) => setS3Prefix(e.target.value)} placeholder="uploads/incoming/" />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Or explicit keys (one per line)</span>
                <textarea className="field-input min-h-28" value={s3Keys} onChange={(e) => setS3Keys(e.target.value)} placeholder="uploads/photo-1.jpg" />
              </label>
              <button type="button" className="btn-primary" disabled={loading} onClick={() => void handleS3Submit()}>
                Import from S3
              </button>
            </div>
          )}

          {tab === 'google_drive' && (
            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Folder ID (full folder import)</span>
                <input className="field-input" value={driveFolderId} onChange={(e) => setDriveFolderId(e.target.value)} placeholder="1A2B3C..." />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Or file IDs (one per line)</span>
                <textarea className="field-input min-h-28" value={driveFileIds} onChange={(e) => setDriveFileIds(e.target.value)} />
              </label>
              <button type="button" className="btn-primary" disabled={loading} onClick={() => void handleDriveSubmit()}>
                Import from Google Drive
              </button>
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {loading && <p className="text-sm text-brand-dark-gray">Importing and starting processing…</p>}
        </div>
      </section>
    </div>
  );
}
