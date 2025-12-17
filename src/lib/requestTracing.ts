import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as Crypto from 'expo-crypto';
import { getOrCreateGuestId } from './guestIdentity';

/**
 * Creates an Axios instance with request tracing enabled.
 * All requests will automatically include:
 * - x-request-id: A unique UUID for each request
 * - x-guest-id: The guest identity UUID (if available)
 * 
 * @returns AxiosInstance - Configured axios instance with interceptors
 */
export function createTracedAxiosInstance(): AxiosInstance {
  const instance = axios.create();

  // Request interceptor to add tracing headers
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Generate unique request ID for this request
      const requestId = await Crypto.randomUUID();
      
      // Ensure headers object exists
      if (!config.headers) {
        config.headers = {} as any;
      }
      
      // Add request ID header
      config.headers['x-request-id'] = requestId;
      
      // Add guest ID header (fail-soft: if it fails, continue without it)
      try {
        const guestId = await getOrCreateGuestId();
        config.headers['x-guest-id'] = guestId;
      } catch (error) {
        // Fail-soft: Log but don't block the request
        console.warn('Failed to get guest ID for request tracing:', error);
      }
      
      return config;
    },
    (error) => {
      // Fail-soft: If interceptor fails, still reject the promise
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling (optional, for future use)
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      // You can add error logging here if needed
      // For now, just pass through the error
      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Default traced axios instance for use throughout the app.
 * Use this instead of the default axios import.
 */
export const tracedAxios = createTracedAxiosInstance();


