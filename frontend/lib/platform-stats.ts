export type PlatformStats = {
  products_count: number;
  product_images_count: number;
  dam_assets_count: number;
  users_count: number;
  calendar_items_count: number;
  yolo_classes_count: number;
  category_labels_count: number;
  db_status: 'connected' | 'disconnected' | string;
  updated_at: string;
};

export const EMPTY_PLATFORM_STATS: PlatformStats = {
  products_count: 0,
  product_images_count: 0,
  dam_assets_count: 0,
  users_count: 0,
  calendar_items_count: 0,
  yolo_classes_count: 0,
  category_labels_count: 0,
  db_status: 'disconnected',
  updated_at: '',
};
