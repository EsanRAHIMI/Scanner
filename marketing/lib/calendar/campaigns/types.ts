export interface MarketingCampaign {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  effective_end_date: string;
  color: string;
  goal: string;
  channels: string;
  created_at?: string;
  updated_at?: string;
}

export type CampaignListResponse = {
  items: MarketingCampaign[];
  limit: number;
  skip: number;
};

export type CampaignFormValues = {
  name: string;
  start_date: string;
  end_date: string;
  color: string;
  goal: string;
  channels: string;
};

export type CampaignLinkedPost = {
  id: string;
  title: string;
  publishDate: string;
  status: string;
};
