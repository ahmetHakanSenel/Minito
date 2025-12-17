import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const GUEST_ID_KEY = 'minito_guest_id';

/**
 * Gets or creates a guest identity UUID stored securely.
 * This UUID is used to identify anonymous users for analytics and request tracing.
 * 
 * @returns Promise<string> - The guest UUID
 */
export async function getOrCreateGuestId(): Promise<string> {
  try {
    // Try to get existing guest ID
    const existingId = await SecureStore.getItemAsync(GUEST_ID_KEY);
    
    if (existingId) {
      return existingId;
    }
    
    // Create new guest ID using expo-crypto
    const newId = await Crypto.randomUUID();
    await SecureStore.setItemAsync(GUEST_ID_KEY, newId);
    
    return newId;
  } catch (error) {
    // Fail-soft: If SecureStore fails, generate a temporary ID
    // This should be logged to Sentry in production
    console.warn('Failed to access SecureStore for guest ID:', error);
    try {
      return await Crypto.randomUUID();
    } catch (cryptoError) {
      // Last resort: fallback to simple random string
      return `guest-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
  }
}

/**
 * Clears the guest identity (for GDPR compliance or logout).
 * 
 * @returns Promise<void>
 */
export async function clearGuestId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_ID_KEY);
  } catch (error) {
    console.warn('Failed to clear guest ID:', error);
  }
}


