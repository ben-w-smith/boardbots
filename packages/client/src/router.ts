/**
 * Simple client-side router for URL-based navigation
 */

export type Route = '/' | '/login' | '/register' | '/dashboard' | '/game';

export interface RouteParams {
  gameCode?: string;
}

class Router {
  private static instance: Router;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): Router {
    if (!Router.instance) {
      Router.instance = new Router();
    }
    return Router.instance;
  }

  /** Get current route based on URL */
  getRoute(): Route {
    const path = window.location.pathname;

    if (path === '/login') return '/login';
    if (path === '/register') return '/register';
    if (path === '/dashboard') return '/dashboard';
    if (path.startsWith('/game/')) return '/game';

    return '/';
  }

  /** Get route params (e.g., game code from URL) */
  getParams(): RouteParams {
    const params: RouteParams = {};
    const path = window.location.pathname;

    // Extract game code from /game/CODE
    const gameMatch = path.match(/^\/game\/([A-Z0-9]{6})$/i);
    if (gameMatch) {
      params.gameCode = gameMatch[1].toUpperCase();
    }

    // Also check query param for backward compatibility
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    if (gameParam && !params.gameCode) {
      params.gameCode = gameParam.toUpperCase();
    }

    return params;
  }

  /** Navigate to a route */
  navigate(route: Route, params?: RouteParams): void {
    const url = this.buildUrl(route, params);
    window.history.pushState({}, '', url);
    this.notifyListeners();
  }

  /** Replace current URL without adding to history */
  replace(route: Route, params?: RouteParams): void {
    const url = this.buildUrl(route, params);
    window.history.replaceState({}, '', url);
    this.notifyListeners();
  }

  /** Build URL from route and params */
  private buildUrl(route: Route, params?: RouteParams): string {
    if (route === '/game' && params?.gameCode) {
      return `/game/${params.gameCode}`;
    }
    return route;
  }

  /** Subscribe to route changes */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Notify all listeners of route change */
  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  /** Handle browser back/forward buttons */
  handlePopState(): void {
    this.notifyListeners();
  }
}

// Set up popstate listener
window.addEventListener('popstate', () => {
  Router.getInstance().handlePopState();
});

export const router = Router.getInstance();
