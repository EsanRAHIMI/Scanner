import { apiFetch } from '@/lib/api';

/**
 * Logs a frontend event to the server for auditing.
 */
export async function logFrontendEvent(action: string, details: string = '', resourceId?: string) {
  try {
    await apiFetch('/admin/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details, resource_id: resourceId }),
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

/**
 * Future service methods for products can be added here.
 * Example: updateProduct, deleteProduct, etc.
 */
