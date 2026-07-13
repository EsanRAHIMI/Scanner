export type ProductsRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

export type ProductsAssetsResponse = {
  columns: string[];
  records: ProductsRecord[];
  count: number;
  has_more?: boolean;
  next_cursor?: string | null;
  page_size?: number;
};
