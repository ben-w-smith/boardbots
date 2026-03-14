import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TopBar } from '../topbar.js';
import { authManager } from '../auth.js';

vi.mock('../auth.js', () => ({
  authManager: {
    getUser: vi.fn(),
    getState: vi.fn(() => ({ isAuthenticated: false, user: null })),
    onAuthChange: vi.fn(),
  }
}));

// Helper to create a mock container
function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  return container;
}

// Helper to clean up DOM
function cleanupDOM() {
  document.body.innerHTML = '';
}

describe('TopBar', () => {
  let container: HTMLElement;
  let onNavigate: ReturnType<typeof vi.fn>;
  let onLogin: ReturnType<typeof vi.fn>;
  let onLogout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(authManager.getUser).mockReturnValue(null);
    vi.mocked(authManager.getState).mockReturnValue({ isAuthenticated: false, user: null });
    container = createMockContainer();
    onNavigate = vi.fn();
    onLogin = vi.fn();
    onLogout = vi.fn();
  });

  afterEach(() => {
    cleanupDOM();
    vi.clearAllMocks();
  });

  describe('unauthenticated state', () => {
    it('renders login/register buttons when not authenticated', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('#topbar-login')).toBeTruthy();
      expect(container.querySelector('#topbar-register')).toBeTruthy();
    });

    it('does not render user avatar when not authenticated', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('.topbar-avatar')).toBeNull();
    });

    it('does not render logout button when not authenticated', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('#topbar-logout')).toBeNull();
    });

    it('calls onLogin when login button is clicked', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const loginBtn = container.querySelector('#topbar-login') as HTMLElement;
      loginBtn?.click();
      expect(onLogin).toHaveBeenCalled();
    });

    it('calls onLogin when register button is clicked (triggers login modal)', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const registerBtn = container.querySelector('#topbar-register') as HTMLElement;
      registerBtn?.click();
      expect(onLogin).toHaveBeenCalled();
    });
  });

  describe('authenticated state', () => {
    beforeEach(() => {
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);
      vi.mocked(authManager.getState).mockReturnValue({ isAuthenticated: true, user: { username: 'testuser' } });
    });

    it('renders username and nav links when authenticated', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('.topbar-avatar')).toBeTruthy();
      expect(container.querySelector('#topbar-logout')).toBeTruthy();
    });

    it('does not render login/register buttons when authenticated', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('#topbar-login')).toBeNull();
      expect(container.querySelector('#topbar-register')).toBeNull();
    });

    it('displays user initials in avatar', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const avatar = container.querySelector('.topbar-avatar');
      expect(avatar?.textContent).toBe('TE');
    });

    it('calls onLogout when logout button is clicked', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const logoutBtn = container.querySelector('#topbar-logout') as HTMLElement;
      logoutBtn?.click();
      expect(onLogout).toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('calls onNavigate with home when logo is clicked', () => {
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);
      vi.mocked(authManager.getState).mockReturnValue({ isAuthenticated: true, user: { username: 'testuser' } });
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const logo = container.querySelector('.topbar-logo') as HTMLElement;
      logo?.click();
      expect(onNavigate).toHaveBeenCalledWith('home');
    });

    it('calls onNavigate when nav links are clicked', () => {
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);
      vi.mocked(authManager.getState).mockReturnValue({ isAuthenticated: true, user: { username: 'testuser' } });
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });

      const playLink = container.querySelector('.topbar-link[data-route="home"]') as HTMLElement;
      playLink?.click();
      expect(onNavigate).toHaveBeenCalledWith('home');

      onNavigate.mockClear();

      const dashboardLink = container.querySelector('.topbar-link[data-route="dashboard"]') as HTMLElement;
      dashboardLink?.click();
      expect(onNavigate).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('active state', () => {
    beforeEach(() => {
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);
    });

    it('sets active class on home route', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      topBar.setActive('home');

      // The logo has data-route="home" but isn't a .topbar-link, check the Play link instead
      const homeLink = container.querySelector('.topbar-link[data-route="home"]');
      expect(homeLink?.classList.contains('active')).toBe(true);

      const dashboardLink = container.querySelector('.topbar-link[data-route="dashboard"]');
      expect(dashboardLink?.classList.contains('active')).toBe(false);
    });

    it('sets active class on dashboard route', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      topBar.setActive('dashboard');

      const dashboardLink = container.querySelector('.topbar-link[data-route="dashboard"]');
      expect(dashboardLink?.classList.contains('active')).toBe(true);

      const homeLink = container.querySelector('.topbar-link[data-route="home"]');
      expect(homeLink?.classList.contains('active')).toBe(false);
    });

    it('does not error when setting active for game (no matching nav link)', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(() => topBar.setActive('game')).not.toThrow();
    });
  });

  describe('show/hide', () => {
    it('hide() and show() toggle visibility', () => {
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      const el = container.querySelector('.topbar') as HTMLElement;

      expect(el.style.display).not.toBe('none');
      topBar.hide();
      expect(el.style.display).toBe('none');
      topBar.show();
      expect(el.style.display).not.toBe('none');
    });
  });

  describe('update', () => {
    it('re-renders when auth state changes', () => {
      // Start unauthenticated
      const topBar = new TopBar({ container, onNavigate, onLogin, onLogout });
      expect(container.querySelector('#topbar-login')).toBeTruthy();
      expect(container.querySelector('.topbar-avatar')).toBeNull();

      // Simulate auth state change
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);
      topBar.update();

      expect(container.querySelector('#topbar-login')).toBeNull();
      expect(container.querySelector('.topbar-avatar')).toBeTruthy();
    });
  });
});
