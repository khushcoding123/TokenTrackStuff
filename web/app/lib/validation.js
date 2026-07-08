const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Structural checks only — password strength policy lives in InsForge
// (see insforge.toml [auth.password]) and is enforced server-side.
export function validateSignupInput({ email, password }) {
  const errors = {};
  if (!email || !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!password || password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateLoginInput({ email, password }) {
  const errors = {};
  if (!email || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return { valid: Object.keys(errors).length === 0, errors };
}
