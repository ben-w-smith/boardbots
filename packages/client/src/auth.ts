/**
 * Auth Module - Handles authentication state and API calls
 */

const TOKEN_KEY = "lockitdown_token";
const USER_KEY = "lockitdown_user";

export interface User {
  id: number;
  username: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

type AuthCallback = () => void;

class AuthManager {
  private static instance: AuthManager;
  private user: User | null = null;
  private token: string | null = null;
  private callbacks: Set<AuthCallback> = new Set();

  private constructor() {
    // Load stored auth state
    this.loadStoredAuth();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /** Get current auth state */
  getState(): AuthState {
    return {
      user: this.user,
      token: this.token,
      isAuthenticated: !!this.user && !!this.token,
    };
  }

  /** Subscribe to auth state changes */
  subscribe(callback: AuthCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Notify all subscribers of state change */
  private notifySubscribers(): void {
    this.callbacks.forEach((cb) => cb());
  }

  /** Login with username and password */
  async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for refresh token
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setAuth(data.user, data.token);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || "Login failed" };
      }
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /** Register a new user */
  async register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setAuth(data.user, data.token);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || "Registration failed" };
      }
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /** Logout */
  logout(): void {
    this.clearAuth();
    // Call logout endpoint to clear httpOnly cookie
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {
        // Ignore errors
      });
  }

  /** Refresh the access token */
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.setAuth(data.user, data.token);
        return true;
      } else {
        this.clearAuth();
        return false;
      }
    } catch {
      this.clearAuth();
      return false;
    }
  }

  /** Get authorization header for API calls */
  getAuthHeader(): string | null {
    return this.token ? `Bearer ${this.token}` : null;
  }

  /** Get the raw access token (for WebSocket auth) */
  getToken(): string | null {
    return this.token;
  }

  /** Make authenticated fetch request */
  async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...options.headers,
      ...this.getAuthHeader() ? { Authorization: this.getAuthHeader()! } : {},
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // If 401, try to refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry with new token
        const newHeaders = {
          ...options.headers,
          Authorization: this.getAuthHeader()!,
        };
        return fetch(url, {
          ...options,
          headers: newHeaders,
          credentials: "include",
        });
      }
    }

    return response;
  }

  /** Load stored auth from localStorage */
  private loadStoredAuth(): void {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
      }
    } catch {
      // Ignore parsing errors
    }
  }

  /** Set auth state and persist */
  private setAuth(user: User, token: string): void {
    this.user = user;
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.notifySubscribers();
  }

  /** Clear auth state */
  private clearAuth(): void {
    this.user = null;
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.notifySubscribers();
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();
