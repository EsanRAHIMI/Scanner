export type ClassItem = {
  id: string;
  name: string;
};

export type NormalizedBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Annotation = {
  class_id: string;
  bbox: NormalizedBBox;
};

export type QueueStatus = 'pending' | 'labeled';

export type QueueItem = {
  item_id: string;
  filename: string;
  status: QueueStatus;
  created_at: string;
  image_url?: string;
  annotation?: Annotation;
};

export type ExportResponse = {
  exported: boolean;
  dataset: string;
  path: string;
  labeled_count: number;
};

export type TrainStartResponse = {
  job_id: string;
  status: 'running';
};

export type TrainStatusResponse = {
  job_id: string;
  status: 'running' | 'finished' | 'failed';
  best_pt: string | null;
  metrics: Record<string, number | string> | null;
  log: string[];
};
