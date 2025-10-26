import type { ApiResponse } from '@rpgate/shared';
import type { LoginInput, RegisterInput } from '@rpgate/shared';
import type { PublicUser } from '@rpgate/shared';

/**
 * Authentication API client for frontend
 * Handles HTTP requests to authentication endpoints with proper error handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AuthResponse {
  user: PublicUser;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

class AuthApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make authenticated API request with automatic cookie handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for session management
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new AuthApiError(
        data.error?.message || 'Request failed',
        response.status,
        data.error?.code
      );
    }

    return data;
  }

  /**
   * Register a new user account
   */
  async register(userData: RegisterInput): Promise<PublicUser> {
    const response = await this.makeRequest<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (!response.success || !response.data) {
      throw new AuthApiError('Registration failed', 400);
    }

    return response.data.user;
  }

  /**
   * Login with username and password
   */
  async login(credentials: LoginInput): Promise<PublicUser> {
    const response = await this.makeRequest<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!response.success || !response.data) {
      throw new AuthApiError('Login failed', 401);
    }

    return response.data.user;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.makeRequest('/api/v1/auth/logout', {
      method: 'POST',
    });
  }

  /**
   * Get current authenticated user information
   */
  async getCurrentUser(): Promise<PublicUser | null> {
    try {
      const response = await this.makeRequest<AuthResponse>('/api/v1/auth/me');
      
      if (!response.success || !response.data) {
        return null;
      }

      return response.data.user;
    } catch (error) {
      // If user is not authenticated, return null instead of throwing
      if (error instanceof AuthApiError && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const authApi = new AuthApiClient();