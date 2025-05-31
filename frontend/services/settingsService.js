// Determine if the code is running on the server or client
const IS_SERVER = typeof window === 'undefined';

// Define API_BASE_URL based on environment
const API_BASE_URL = IS_SERVER
  ? `http://proxy/api` // For SSR, use internal Docker network address
  : '/api'; // For client-side, use relative path for Nginx proxy

export async function fetchSiteSettings() {
  const res = await fetch(`${API_BASE_URL}/settings/`);
  if (!res.ok) {
    throw new Error('Failed to fetch site settings');
  }
  return res.json();
} 