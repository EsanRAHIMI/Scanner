export type ProductsRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

export type ProductsAssetsResponse = {
  columns: string[];
  records: ProductsRecord[];
  count: number;
};
