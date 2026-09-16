import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createTracedAxiosInstance } from '../requestTracing';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

type Interceptor = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;

// Axios keeps registered interceptors on an internal list; the first one is ours.
function tracingInterceptor(): Interceptor {
  const manager = createTracedAxiosInstance().interceptors.request as unknown as {
    handlers: { fulfilled: Interceptor }[];
  };
  return manager.handlers[0].fulfilled;
}

describe('traced axios', () => {
  it('adds a tracing id to requests that have none', () => {
    const config = tracingInterceptor()({ headers: new AxiosHeaders() });
    expect(config.headers.get('x-request-id')).toBe('generated-id');
  });

  it('keeps the id a caller already chose', () => {
    const headers = new AxiosHeaders({ 'x-request-id': 'caller-id' });
    const config = tracingInterceptor()({ headers });
    expect(config.headers.get('x-request-id')).toBe('caller-id');
  });
});
