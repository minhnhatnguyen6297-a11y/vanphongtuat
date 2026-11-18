const LOGIN_HINT_KEY = 'hng-login-hint';

/** Remember the new username only. Never store a PIN. */
export function rememberLoginHint(username: string): void {
  try {
    sessionStorage.setItem(LOGIN_HINT_KEY, username);
  } catch {
    /* private mode */
  }
}

export function readLoginHint(): string {
  try {
    return sessionStorage.getItem(LOGIN_HINT_KEY) || '';
  } catch {
    return '';
  }
}

export function clearLoginHint(): void {
  try {
    sessionStorage.removeItem(LOGIN_HINT_KEY);
  } catch {
    /* ignore */
  }
}
