// Airtable API Configuration
export const AIRTABLE_CONFIG = {
  BASE_ID: process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || '',
  TABLE_NAME: process.env.NEXT_PUBLIC_AIRTABLE_TABLE || 'Content Calendar',
  API_KEY: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || '',
};

// Airtable API endpoint
export const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.BASE_ID}/${AIRTABLE_CONFIG.TABLE_NAME}`;

// Content item interface matching Airtable fields
export interface ContentItem {
  id: string;
  fields: {
    'Title': string;
    'Description': string;
    'Publish Date': string;
    'Status': string;
    'Platform': string;
    'Content Type': string;
    'Tags': string[];
    'Author': string;
    'Priority': string;
    'Estimated Reach': number;
    'Actual Reach'?: number;
    'Engagement Rate'?: number;
    'Created At': string;
    'Updated At': string;
  };
  createdTime: string;
}

// Helper functions for Airtable API
export async function fetchContentCalendar(): Promise<ContentItem[]> {
  try {
    const response = await fetch(AIRTABLE_API_URL, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.records;
  } catch (error) {
    console.error('Error fetching content calendar:', error);
    throw error;
  }
}

export async function updateContentItem(id: string, fields: Partial<ContentItem['fields']>): Promise<ContentItem> {
  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ...fields,
          'Updated At': new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating content item:', error);
    throw error;
  }
}

export async function createContentItem(fields: Omit<ContentItem['fields'], 'Created At' | 'Updated At'>): Promise<ContentItem> {
  try {
    const response = await fetch(AIRTABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ...fields,
          'Created At': new Date().toISOString(),
          'Updated At': new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating content item:', error);
    throw error;
  }
}

export async function deleteContentItem(id: string): Promise<void> {
  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting content item:', error);
    throw error;
  }
}
