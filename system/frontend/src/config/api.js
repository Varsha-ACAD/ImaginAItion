// API Configuration for different environments

const getApiBaseUrl = () => {
  // Explicit URL always wins, in any mode
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL;
  }

  // Dev server with no explicit URL configured - assume local backend
  if (import.meta.env.DEV) {
    return 'http://localhost:5004';
  }

  // Production build with no explicit URL - use relative paths (current origin)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();
export const API_ENDPOINTS = {
  // Admin endpoints
  ADMIN_LOGIN: `${API_BASE_URL}/api/admin/login`,
  ADMIN_LOGOUT: `${API_BASE_URL}/api/admin/logout`,
  ADMIN_VERIFY: `${API_BASE_URL}/api/admin/verify`,
  ADMIN_LIST_LOGS: `${API_BASE_URL}/api/admin/list-game-logs-detailed`,
  ADMIN_GET_LOG: (gameId) => `${API_BASE_URL}/api/admin/game-log/${gameId}`,
  ADMIN_EXPORT_LOGS: `${API_BASE_URL}/api/admin/export-logs`,
};

// Utility function for image URLs
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) return imagePath;

  // Use API_BASE_URL for image paths
  return `${API_BASE_URL}${imagePath}`;
};

console.log('API Base URL:', API_BASE_URL);