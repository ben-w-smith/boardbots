/**
 * Register Page - Full page registration UI
 */

import { authManager, type User } from "./auth.js";

export interface RegisterPageOptions {
  container: HTMLElement;
  onRegister: (user: User) => void;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

export class RegisterPage {
  private container: HTMLElement;
  private pageEl: HTMLElement;
  private onRegister: (user: User) => void;
  private onSwitchToLogin: () => void;
  private onBack: () => void;

  constructor(options: RegisterPageOptions) {
    this.container = options.container;
    this.onRegister = options.onRegister;
    this.onSwitchToLogin = options.onSwitchToLogin;
    this.onBack = options.onBack;

    // Create page element
    this.pageEl = document.createElement("div");
    this.pageEl.className = "auth-page";
    this.pageEl.style.display = "none";
    this.container.appendChild(this.pageEl);

    this.render();
  }

  /** Show the page */
  show(): void {
    this.render();
    this.pageEl.style.display = "flex";
  }

  /** Hide the page */
  hide(): void {
    this.pageEl.style.display = "none";
  }

  private render(): void {
    this.pageEl.innerHTML = `
      <div class="auth-container">
        <button class="back-button" id="back-btn">← Back</button>

        <div class="auth-header">
          <h1>Lock It Down</h1>
          <p>Create your account</p>
        </div>

        <form id="auth-form" class="auth-form" action="#" method="post">
          <div class="form-group">
            <label for="auth-username">Username</label>
            <input
              type="text"
              id="auth-username"
              name="username"
              class="auth-input"
              placeholder="Choose a username"
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
              class="auth-input"
              placeholder="8+ chars, uppercase, lowercase, number"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="form-group">
            <label for="auth-confirm">Confirm Password</label>
            <input
              type="password"
              id="auth-confirm"
              name="confirm-password"
              class="auth-input"
              placeholder="Confirm your password"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="auth-error" id="auth-error"></div>

          <button type="submit" class="auth-submit primary" id="submit-btn">Create Account</button>
        </form>

        <div class="auth-switch">
          <span>Already have an account?</span>
          <button class="link-button" id="switch-btn">Sign In</button>
        </div>
      </div>
    `;

    this.setupHandlers();
  }

  private setupHandlers(): void {
    const form = this.pageEl.querySelector("#auth-form") as HTMLFormElement;
    const backBtn = this.pageEl.querySelector("#back-btn");
    const switchBtn = this.pageEl.querySelector("#switch-btn");

    backBtn?.addEventListener("click", () => {
      this.onBack();
    });

    switchBtn?.addEventListener("click", () => {
      this.onSwitchToLogin();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const usernameInput = this.pageEl.querySelector("#auth-username") as HTMLInputElement;
    const passwordInput = this.pageEl.querySelector("#auth-password") as HTMLInputElement;
    const confirmInput = this.pageEl.querySelector("#auth-confirm") as HTMLInputElement;
    const errorEl = this.pageEl.querySelector("#auth-error") as HTMLElement;
    const submitBtn = this.pageEl.querySelector("#submit-btn") as HTMLButtonElement;

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirm = confirmInput?.value || "";

    // Clear previous error
    errorEl.style.display = "none";

    // Validate password match
    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match";
      errorEl.style.display = "block";
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    // Call auth API
    const result = await authManager.register(username, password);

    if (result.success) {
      const state = authManager.getState();
      if (state.user) {
        this.onRegister(state.user);
      }
    } else {
      errorEl.textContent = result.error || "An error occurred";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  }
}
