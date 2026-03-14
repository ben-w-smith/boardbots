/**
 * Login Modal - Handles login and registration UI
 */

import { authManager, type User } from "./auth.js";

export interface LoginModalOptions {
  container: HTMLElement;
  onLogin?: (user: User) => void;
  onClose?: () => void;
}

type LoginMode = "login" | "register";

export class LoginModal {
  private container: HTMLElement;
  private modalEl: HTMLElement;
  private currentMode: LoginMode = "login";
  private onLogin?: (user: User) => void;
  private onClose?: () => void;

  constructor(options: LoginModalOptions) {
    this.container = options.container;
    this.onLogin = options.onLogin;
    this.onClose = options.onClose;

    // Create modal element
    this.modalEl = document.createElement("div");
    this.modalEl.className = "login-modal-overlay";
    this.modalEl.style.display = "none";
    this.container.appendChild(this.modalEl);

    this.render();
  }

  /** Show the modal */
  show(mode: LoginMode = "login"): void {
    this.currentMode = mode;
    this.render();
    this.modalEl.style.display = "flex";
  }

  /** Hide the modal */
  hide(): void {
    this.modalEl.style.display = "none";
  }

  /** Toggle between login and register modes */
  toggleMode(): void {
    this.currentMode = this.currentMode === "login" ? "register" : "login";
    this.render();
  }

  private render(): void {
    const isLogin = this.currentMode === "login";

    this.modalEl.innerHTML = `
      <div class="login-modal">
        <button class="modal-close" id="modal-close">&times;</button>
        <div class="login-modal-header">
          <h2>${isLogin ? "Sign In" : "Create Account"}</h2>
        </div>
        <form id="auth-form" class="login-form" action="#" method="post">
          <div class="form-group">
            <label for="auth-username">Username</label>
            <input
              type="text"
              id="auth-username"
              name="username"
              class="lobby-input"
              placeholder="Enter username"
              maxlength="20"
              autocomplete="username"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              required
            />
          </div>
          <div class="form-group">
            <label for="auth-password">Password</label>
            <input
              type="password"
              id="auth-password"
              name="password"
              class="lobby-input"
              placeholder="${isLogin ? "Enter password" : "Create password (8+ chars, uppercase, lowercase, number)"}"
              autocomplete="${isLogin ? "current-password" : "new-password"}"
              required
            />
          </div>
          ${!isLogin ? `
            <div class="form-group">
              <label for="auth-confirm">Confirm Password</label>
              <input
                type="password"
                id="auth-confirm"
                name="confirm-password"
                class="lobby-input"
                placeholder="Confirm password"
                autocomplete="new-password"
                required
              />
            </div>
          ` : ""}
          <div class="login-error" id="auth-error"></div>
          <div class="login-buttons">
            <button type="submit" class="primary" id="submit-btn">${isLogin ? "Sign In" : "Create Account"}</button>
            <button type="button" class="secondary" id="cancel-btn">Cancel</button>
          </div>
        </form>
        <div class="login-switch">
          <span>${isLogin ? "Don't have an account?" : "Already have an account?"}</span>
          <button class="link-button" id="switch-mode">${isLogin ? "Sign Up" : "Sign In"}</button>
        </div>
      </div>
    `;

    this.setupHandlers();
  }

  private setupHandlers(): void {
    const closeBtn = this.modalEl.querySelector("#modal-close");
    const cancelBtn = this.modalEl.querySelector("#cancel-btn");
    const form = this.modalEl.querySelector("#auth-form") as HTMLFormElement;
    const switchBtn = this.modalEl.querySelector("#switch-mode");

    // Close button (X)
    closeBtn?.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });

    // Cancel button
    cancelBtn?.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });

    // Note: Clicking outside the modal does NOT close it
    // Users must explicitly click X or Cancel to dismiss

    // Switch mode button
    switchBtn?.addEventListener("click", () => {
      this.toggleMode();
    });

    // Form submission
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const usernameInput = this.modalEl.querySelector("#auth-username") as HTMLInputElement;
    const passwordInput = this.modalEl.querySelector("#auth-password") as HTMLInputElement;
    const confirmInput = this.modalEl.querySelector("#auth-confirm") as HTMLInputElement;
    const errorEl = this.modalEl.querySelector(".login-error") as HTMLElement;
    const submitBtn = this.modalEl.querySelector('button[type="submit"]') as HTMLButtonElement;

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirm = confirmInput?.value || "";

    // Clear previous error
    errorEl.style.display = "none";

    // Validate
    if (this.currentMode === "register") {
      if (password !== confirm) {
        errorEl.textContent = "Passwords do not match";
        errorEl.style.display = "block";
        return;
      }
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = this.currentMode === "login" ? "Signing in..." : "Creating account...";

    // Call auth API
    const result =
      this.currentMode === "login"
        ? await authManager.login(username, password)
        : await authManager.register(username, password);

    if (result.success) {
      const state = authManager.getState();
      if (state.user) {
        this.onLogin?.(state.user);
        this.hide();
      }
    } else {
      errorEl.textContent = result.error || "An error occurred";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = this.currentMode === "login" ? "Sign In" : "Create Account";
    }
  }
}
