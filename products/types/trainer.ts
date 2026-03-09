export type ProductsAirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

export type ProductsAssetsResponse = {
  columns: string[];
  records: ProductsAirtableRecord[];
  count: number;
};
