import axios, { type AxiosInstance } from 'axios';
import * as Crypto from 'expo-crypto';

/** A fresh tracing id. */
export function newRequestId(): string {
  return Crypto.randomUUID();
}

/**
 * An Axios instance that tags every request with an `x-request-id`, so a client log line can be
 * matched with the server's. A caller that already set one keeps it: the id it logs and the id
 * the server logs must be the same.
 */
export function createTracedAxiosInstance(): AxiosInstance {
  const instance = axios.create();

  instance.interceptors.request.use((config) => {
    if (!config.headers.has('x-request-id')) {
      config.headers.set('x-request-id', newRequestId());
    }
    return config;
  });

  return instance;
}

/** The traced instance for all app HTTP calls. Use this instead of the default axios import. */
export const tracedAxios = createTracedAxiosInstance();
