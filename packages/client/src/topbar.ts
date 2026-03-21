/**
 * Top Bar Navigation Component
 * Displays global navigation with logo, nav links, and user status
 */

import { authManager } from './auth.js';
import { escapeHtml } from './utils/html.js';

export interface TopBarOptions {
  container: HTMLElement;
  onNavigate: (route: 'home' | 'dashboard') => void;
  onLogin: () => void;
  onLogout: () => void;
}

export class TopBar {
  private container: HTMLElement;
  private el: HTMLElement;
  private options: TopBarOptions;

  constructor(options: TopBarOptions) {
    this.container = options.container;
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = 'topbar';
    this.render();
    this.container.appendChild(this.el);
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  update(): void {
    this.render();
  }

  setActive(route: 'home' | 'dashboard' | 'game'): void {
    this.el.querySelectorAll('.topbar-link').forEach(link => {
      link.classList.remove('active');
      if ((link as HTMLElement).dataset.route === route) {
        link.classList.add('active');
      }
    });
  }

  private render(): void {
    const user = authManager.getUser();

    if (user) {
      // Authenticated: logo + nav links + user avatar + logout
      const initials = this.getInitials(user.username);
      this.el.innerHTML = `
        <div class="topbar-logo" data-route="home">BoardBots</div>
        <nav class="topbar-nav">
          <button class="topbar-link" data-route="home">Play</button>
          <button class="topbar-link" data-route="dashboard">Dashboard</button>
        </nav>
        <div class="topbar-user">
          <div class="topbar-avatar">${escapeHtml(initials)}</div>
          <button class="topbar-link" id="topbar-logout">Logout</button>
        </div>
      `;
    } else {
      // Not authenticated: logo + login/register buttons
      this.el.innerHTML = `
        <div class="topbar-logo" data-route="home">BoardBots</div>
        <nav class="topbar-nav">
          <button class="topbar-link" id="topbar-login">Log In</button>
          <button class="topbar-link" id="topbar-register">Create Account</button>
        </nav>
      `;
    }

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Logo click
    this.el.querySelector('.topbar-logo')?.addEventListener('click', () => {
      this.options.onNavigate('home');
    });

    // Nav links
    this.el.querySelectorAll('.topbar-link[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        const route = (link as HTMLElement).dataset.route as 'home' | 'dashboard';
        if (route) {
          this.options.onNavigate(route);
        }
      });
    });

    // Login button
    this.el.querySelector('#topbar-login')?.addEventListener('click', () => {
      this.options.onLogin();
    });

    // Register button
    this.el.querySelector('#topbar-register')?.addEventListener('click', () => {
      this.options.onLogin(); // Trigger login modal which has register option
    });

    // Logout button
    this.el.querySelector('#topbar-logout')?.addEventListener('click', () => {
      this.options.onLogout();
    });
  }

  private getInitials(username: string): string {
    return username.slice(0, 2).toUpperCase();
  }
}
