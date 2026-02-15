import { API_CONFIG } from '@/config/api';



export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const extractErrorMessage = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  return getString(value, 'message') || getString(value, 'detail') || getString(value, 'error');
};


class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const extractedError = extractErrorMessage(data) || 'Request failed';

        // If the stored token is no longer valid (common after backend restart when SECRET_KEY changes),
        // clear local auth state to avoid the app getting stuck on empty pages.
        if (response.status === 401 && token) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');

          if (typeof window !== 'undefined') {
            const loginPath = window.location.pathname.startsWith('/official') ? '/official/login' : '/login';
            if (window.location.pathname !== loginPath) {
              window.location.href = loginPath;
            }
          }
        }

        return {
          success: false,
          error: extractedError,
        };
      }

      if (isRecord(data) && data.success === false) {
        return {
          success: false,
          error: extractErrorMessage(data) || 'Request failed',
        };
      }

      const payload = isRecord(data) && 'data' in data ? (data as Record<string, unknown>).data : data;
      return {
        success: true,
        data: payload as T,
        message: isRecord(data) ? getString(data, 'message') : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
    }

    const token = localStorage.getItem('auth_token');

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        return {
          success: false,
          error: extractErrorMessage(data) || 'Upload failed',
        };
      }

      if (isRecord(data) && data.success === false) {
        return {
          success: false,
          error: extractErrorMessage(data) || 'Upload failed',
        };
      }

      const payload = isRecord(data) && 'data' in data ? (data as Record<string, unknown>).data : data;
      return {
        success: true,
        data: payload as T,
        message: isRecord(data) ? getString(data, 'message') : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }
}

export const apiClient = new ApiClient();
