/**
 * Client-side router with guards and middleware support
 */

export type Route = '/' | '/login' | '/register' | '/dashboard' | '/game';

export interface RouteParams {
  gameCode?: string;
}

/** Route guard - returns true to allow navigation, false to block */
export type RouteGuard = (params: RouteParams) => boolean | Promise<boolean>;

/** Route component renderer */
export type RouteComponent = (params: RouteParams) => void | Promise<void>;

/** Route configuration */
export interface RouteConfig {
  path: Route;
  component: RouteComponent;
  guards?: RouteGuard[];
}

class Router {
  private static instance: Router;
  private listeners: Set<() => void> = new Set();
  private routes: Map<Route, RouteConfig> = new Map();
  private currentParams: RouteParams = {};

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

  /** Register a route with optional guards */
  register(config: RouteConfig): void {
    this.routes.set(config.path, config);
  }

  /** Handle the current route - run guards and render component */
  async handleRoute(): Promise<boolean> {
    const route = this.getRoute();
    const params = this.getParams();
    this.currentParams = params;

    const config = this.routes.get(route);
    if (!config) {
      console.warn(`No route handler registered for: ${route}`);
      return false;
    }

    // Run guards in order
    if (config.guards) {
      for (const guard of config.guards) {
        const allowed = await guard(params);
        if (!allowed) {
          // Guard blocked navigation - it should have redirected
          return false;
        }
      }
    }

    // Run component
    await config.component(params);
    this.notifyListeners();
    return true;
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

  /** Get current cached params */
  getCurrentParams(): RouteParams {
    return { ...this.currentParams };
  }
}

// Set up popstate listener
window.addEventListener('popstate', () => {
  Router.getInstance().handlePopState();
});

export const router = Router.getInstance();
