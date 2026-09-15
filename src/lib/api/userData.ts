import { tracedAxios } from '../requestTracing';
import { getSupabase } from '../../data/supabase/client';

const SUPABASE_EDGE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL;

/**
 * Delete user account and all associated data (GDPR Right to be Forgotten)
 * @throws Error if deletion fails
 */
export async function deleteUserAccount(): Promise<void> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  if (!session) {
    throw new Error('No active session. Please sign in first.');
  }

  const edgeFunctionUrl =
    SUPABASE_EDGE_FUNCTION_URL?.replace('/break-task', '/delete-user') ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$|$/, '/functions/v1/delete-user');

  if (!edgeFunctionUrl) {
    throw new Error('Edge function URL not configured');
  }

  try {
    const response = await tracedAxios.delete(edgeFunctionUrl, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 200) {
      throw new Error('Failed to delete user account');
    }
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.error || 'Failed to delete user account');
    }
    throw error;
  }
}

/**
 * Export user data (GDPR Right to Data Portability)
 * @returns User data as JSON object
 */
export async function exportUserData(): Promise<any> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  if (!session) {
    throw new Error('No active session. Please sign in first.');
  }

  const edgeFunctionUrl =
    SUPABASE_EDGE_FUNCTION_URL?.replace('/break-task', '/export-user-data') ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$|$/, '/functions/v1/export-user-data');

  if (!edgeFunctionUrl) {
    throw new Error('Edge function URL not configured');
  }

  try {
    const response = await tracedAxios.get(edgeFunctionUrl, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 200) {
      throw new Error('Failed to export user data');
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.error || 'Failed to export user data');
    }
    throw error;
  }
}
