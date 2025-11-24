// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getApiUrl = (endpoint: string): string => {
  // In development, use localhost:8000
  // In production, use the full backend URL
  return `${API_URL}${endpoint}`;
};

export const getWebSocketUrl = (endpoint: string): string => {
  // Convert HTTP(S) to WS(S) for WebSocket connections
  if (API_URL) {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsUrl}${endpoint}`;
  }
  // Development fallback - use backend WebSocket port
  return `ws://localhost:8000${endpoint}`;
};
