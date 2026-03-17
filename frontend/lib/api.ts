import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get API_URL from environment variable, with fallback defaults
const getApiBaseUrl = (): string => {
  // Try Constants.expoConfig.extra first (configured in app.config.js)
  const configApiUrl = Constants.expoConfig?.extra?.API_URL;
  if (configApiUrl) {
    const url = configApiUrl.endsWith('/api') ? configApiUrl : `${configApiUrl}/api`;
    console.log('[API] Using API_URL from Constants.expoConfig.extra:', url);
    return url;
  }
  
  // Try process.env (works in web builds)
  const envApiUrl = process.env.API_URL || process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    const url = envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;
    console.log('[API] Using API_URL from process.env:', url);
    return url;
  }
  
  // Fallback to default
  const fallbackUrl = __DEV__ 
    ? 'http://127.0.0.1:8000/api' 
    : 'https://your-production-api.com/api';
  console.warn('[API] No API_URL found in env, using fallback:', fallbackUrl);
  return fallbackUrl;
};

const API_BASE_URL = getApiBaseUrl();
console.log('[API] Final API_BASE_URL:', API_BASE_URL);
console.log('[API] Platform:', Platform.OS);
console.log('[API] Constants.expoConfig:', JSON.stringify(Constants.expoConfig?.extra, null, 2));

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: number;
      email: string;
      username: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
    };
    tokens: {
      access: string;
      refresh: string;
    };
  };
  errors?: Record<string, string[]>;
}

export interface TemplateField {
  type: 'text' | 'choice' | 'datetime' | 'time' | 'file'; // 'time' kept for backward compatibility
  name: string;
  choices?: string[]; // Only for 'choice' type
}

export interface Template {
  id: number;
  name: string;
  description: string;
  fields: TemplateField[];
  created_at: string;
  updated_at: string;
}

export interface TemplateRequest {
  name: string;
  description?: string;
  fields: TemplateField[];
}

export interface TemplateResponse {
  success: boolean;
  message?: string;
  data?: Template | Template[];
  errors?: Record<string, string[]>;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  template: number;
  template_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRequest {
  name: string;
  description?: string;
  template: number;
}

export interface ProjectResponse {
  success: boolean;
  message?: string;
  data?: Project | Project[];
  errors?: Record<string, string[]>;
}

export interface Report {
  id: number;
  project: number;
  project_name?: string;
  data: Record<string, any>; // Dictionary mapping field names to values
  template_fields?: TemplateField[]; // Fields from the template
  created_at: string;
  updated_at: string;
}

export interface ReportRequest {
  project: number;
  data: Record<string, any>;
}

export interface ReportResponse {
  success: boolean;
  message?: string;
  data?: Report | Report[];
  errors?: Record<string, string[]>;
}

export interface UploadUrlRequest {
  field_name: string;
  filename: string;
  content_type?: string;
}

export interface UploadUrlResponse {
  success: boolean;
  message?: string;
  data?: {
    upload_url: string;
    file_key: string;
  };
  errors?: Record<string, string[]>;
}

export interface DownloadUrlRequest {
  file_key: string;
}

export interface DownloadUrlResponse {
  success: boolean;
  message?: string;
  data?: {
    url: string;
  };
  errors?: Record<string, string[]>;
}

class ApiService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const accessToken = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    };
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  private async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const url = `${API_BASE_URL}/auth/login/`;
    console.log('[API] Login request to:', url);
    console.log('[API] Login payload:', { email: credentials.email, password: '***' });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('[API] Login response status:', response.status);
      const data: AuthResponse = await response.json();
      console.log('[API] Login response:', data);

      if (data.success && data.data?.tokens) {
        await this.setTokens(data.data.tokens.access, data.data.tokens.refresh);
      }

      return data;
    } catch (error) {
      console.error('[API] Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[API] Error details:', {
        message: errorMessage,
        url,
        apiBaseUrl: API_BASE_URL,
      });
      return {
        success: false,
        message: `Network error: ${errorMessage}. Please check your connection and ensure the backend is running at ${API_BASE_URL}`,
        errors: { network: [errorMessage] },
      };
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const url = `${API_BASE_URL}/auth/register/`;
    console.log('[API] Register request to:', url);
    console.log('[API] Register payload:', { ...userData, password: '***', password2: '***' });
    console.log('[API] Full request details:', {
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      console.log('[API] Register response status:', response.status);
      console.log('[API] Register response headers:', Object.fromEntries(response.headers.entries()));
      console.log('[API] Register response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Register error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          return errorData as AuthResponse;
        } catch {
          return {
            success: false,
            message: `Server error: ${response.status} ${response.statusText}`,
            errors: { server: [errorText] },
          };
        }
      }
      
      const data: AuthResponse = await response.json();
      console.log('[API] Register response:', data);

      if (data.success && data.data?.tokens) {
        await this.setTokens(data.data.tokens.access, data.data.tokens.refresh);
      }

      return data;
    } catch (error) {
      console.error('[API] Register error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[API] Error details:', {
        message: errorMessage,
        url,
        apiBaseUrl: API_BASE_URL,
      });
      return {
        success: false,
        message: `Network error: ${errorMessage}. Please check your connection and ensure the backend is running at ${API_BASE_URL}`,
        errors: { network: [errorMessage] },
      };
    }
  }

  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refresh: refreshToken }),
      });

      const data = await response.json();
      await this.clearTokens();
      return data;
    } catch (error) {
      await this.clearTokens();
      return {
        success: false,
        message: 'Logout failed',
      };
    }
  }

  async getProfile(): Promise<AuthResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/profile/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch profile',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  // Template CRUD methods
  async getTemplates(): Promise<TemplateResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/templates/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch templates',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async getTemplate(id: number): Promise<TemplateResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/templates/${id}/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch template',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async createTemplate(template: TemplateRequest): Promise<TemplateResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/templates/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(template),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create template',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async updateTemplate(id: number, template: Partial<TemplateRequest>): Promise<TemplateResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/templates/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(template),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update template',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async deleteTemplate(id: number): Promise<TemplateResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/templates/${id}/`, {
        method: 'DELETE',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete template',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  // Project CRUD methods
  async getProjects(): Promise<ProjectResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/projects/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async getProject(id: number): Promise<ProjectResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/projects/${id}/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch project',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async createProject(project: ProjectRequest): Promise<ProjectResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/projects/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(project),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create project',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async updateProject(id: number, project: Partial<ProjectRequest>): Promise<ProjectResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/projects/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(project),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update project',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async deleteProject(id: number): Promise<ProjectResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/projects/${id}/`, {
        method: 'DELETE',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete project',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  // Report CRUD methods
  async getReports(projectId?: number): Promise<ReportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const url = projectId 
        ? `${API_BASE_URL}/projects/reports/?project=${projectId}`
        : `${API_BASE_URL}/projects/reports/`;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch reports',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async getReport(id: number): Promise<ReportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/reports/${id}/`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch report',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async createReport(report: ReportRequest): Promise<ReportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/reports/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(report),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create report',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async updateReport(id: number, report: Partial<ReportRequest>): Promise<ReportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/reports/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(report),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update report',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async deleteReport(id: number): Promise<ReportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/reports/${id}/`, {
        method: 'DELETE',
        headers,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete report',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  // File upload/download methods
  async getUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/upload-url/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get upload URL',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }

  async getDownloadUrl(request: DownloadUrlRequest): Promise<DownloadUrlResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/projects/download-url/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get download URL',
        errors: { network: ['Failed to connect to server'] },
      };
    }
  }
}

export const apiService = new ApiService();
