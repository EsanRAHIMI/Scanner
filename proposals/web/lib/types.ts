export type Me = {
  id: string;
  username?: string;
  email?: string;
  role: string;
  is_admin: boolean;
};

export type CatalogProduct = {
  id: string;
  name: string;
  code: string;
  category: string;
  material: string;
  color: string;
  space: string;
  size: string;
  pieces: string;
  light: string;
  description: string;
  drawing_url: string | null;
  price_raw: string;
  price: number | null;
  image_urls: string[];
  image_url: string | null;
};

export type ProposalItem = {
  id: string;
  product_id?: string | null;
  room?: string;
  qty?: number;
  name?: string;
  code?: string;
  design?: string;
  category?: string;
  material?: string;
  color?: string;
  size?: string;
  pieces?: string;
  light?: string;
  description?: string;
  price?: number | null;
  price_raw?: string;
  image_url?: string;
  image_urls?: string[];
  drawing_url?: string;
  room_image_url?: string;
  spec_title?: string;
};

export type ProposalPage = {
  id: string;
  type:
    | 'cover'
    | 'intro'
    | 'room_title'
    | 'product_visual'
    | 'product_spec'
    | 'pricing_summary'
    | 'custom'
    | 'closing';
  data: Record<string, unknown>;
};

export type Pricing = {
  currency?: string;
  subtotal?: number;
  discount_pct?: number;
  discount_amount?: number;
  vat_pct?: number;
  vat_amount?: number;
  total?: number;
  notes?: string;
};

export type Proposal = {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'archived';
  customer: { name?: string; phone?: string; email?: string };
  project: { name?: string; location?: string; kind?: string; validity_date?: string };
  salesperson: {
    name?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    signature_text?: string;
  };
  created_by: string;
  created_by_name?: string;
  template_id: string;
  items: ProposalItem[];
  pricing: Pricing;
  pages: ProposalPage[];
  pdf_key?: string | null;
  pdf_url?: string | null;
  share_token?: string | null;
  version?: number;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: string;
  name: string;
  slug?: string;
  scope: 'global' | 'assigned';
  assigned_user_ids: string[];
  active: boolean;
  branding: Record<string, string>;
  fixed_pages: Record<string, Record<string, string>>;
  pricing_defaults: {
    currency?: string;
    discount_pct?: number;
    vat_pct?: number;
    included_services?: string[];
  };
  created_at?: string;
  updated_at?: string;
};
