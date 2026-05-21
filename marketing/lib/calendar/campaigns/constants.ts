export const CAMPAIGN_COLOR_PRESETS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
] as const;

export const CAMPAIGN_RAIL_WIDTH_PX = 168;

export const DEFAULT_CAMPAIGN_FORM = {
  name: '',
  start_date: '',
  end_date: '',
  color: CAMPAIGN_COLOR_PRESETS[0],
  goal: '',
  channels: '',
};
