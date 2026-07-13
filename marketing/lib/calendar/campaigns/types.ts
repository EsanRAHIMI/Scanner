export interface MarketingCampaign {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  effective_end_date: string;
  color: string;
  goal: string;
  channels: string;
  /** High-priority campaign — surfaced prominently in the calendar. */
  is_critical: boolean;
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
  is_critical: boolean;
};

export type CampaignLinkedPost = {
  id: string;
  title: string;
  publishDate: string;
  status: string;
};
