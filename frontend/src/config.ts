const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;

export const API_BASE_URL =
  metaEnv?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const WS_BASE_URL =
  metaEnv?.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000';
