import type { AuthProvider } from '@/services/auth/AuthProvider';

export interface ApiClientOptions {
  baseUrl: string;
  authProvider?: AuthProvider;
}

export class ApiClient {
  private baseUrl: string;
  private authProvider?: AuthProvider;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authProvider = options.authProvider;
  }

  private async getHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra as Record<string, string> | undefined),
    };

    if (this.authProvider) {
      const token = await this.authProvider.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new ApiError('Request failed', response.status);
    }
    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: await this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
