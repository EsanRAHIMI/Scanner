export interface FeedMediaItem {
  originalUrl: string;
  url: string;
  driveId: string | null;
  isVideo: boolean;
}

export interface FeedVariant {
  id: string;
  url: string;
  originalUrl: string;
  driveId: string | null;
  allMedia: FeedMediaItem[];
  title: string;
  collectionName: string;
  collectionNameNormalized: string;
  code: string;
  variant: string;
  dimension: string;
  note: string;
  price: string | null;
  category: string;
  space: string;
  color: string;
  material: string;
  codeNumber: string;
  l000: string;
  num: string;
  isMain: boolean;
}
