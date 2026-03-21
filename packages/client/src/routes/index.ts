/**
 * Route definitions and guards for the application
 */

import { authManager } from '../auth.js';
import { router, type RouteConfig, type RouteParams } from '../router.js';

/** Guard: Requires user to be authenticated */
export async function requireAuth(_params: RouteParams): Promise<boolean> {
  const state = authManager.getState();
  if (state.isAuthenticated) {
    return true;
  }
  // Redirect to login
  router.navigate('/login');
  return false;
}

/** Guard: Requires user to NOT be authenticated (for login/register pages) */
export async function requireGuest(_params: RouteParams): Promise<boolean> {
  const state = authManager.getState();
  if (!state.isAuthenticated) {
    return true;
  }
  // Redirect to dashboard
  router.navigate('/dashboard');
  return false;
}

/** Route configuration type with lazy loading */
export interface RouteDefinition {
  path: RouteConfig['path'];
  load: () => Promise<{ default: RouteConfig['component'] }>;
  guards?: RouteConfig['guards'];
}

/**
 * Register all application routes
 */
export function registerRoutes(routes: RouteDefinition[]): void {
  for (const route of routes) {
    router.register({
      path: route.path,
      component: async (params: RouteParams) => {
        const module = await route.load();
        await module.default(params);
      },
      guards: route.guards,
    });
  }
}
