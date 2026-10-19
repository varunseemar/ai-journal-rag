import { useState } from 'react';
import { isValidEmail, passwordProblem, passwordStrength } from '../validation.js';

const EMPTY_TOUCHED = { email: false, password: false, confirm: false };

// One form for both log in and sign up.
// Errors appear under each field once it has been touched (left) or on submit, and errors
// returned by the server (e.g. "email already registered") are shown on the matching field.
export default function AuthForm({ onSubmit }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(EMPTY_TOUCHED);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  // Client-side checks, recomputed on every render.
  const clientErrors = {
    email: !email.trim()
      ? 'Enter your email'
      : !isValidEmail(email)
        ? 'Enter a valid email address, like name@example.com'
        : null,
    password: isSignup ? passwordProblem(password, email) : password ? null : 'Enter your password',
    confirm: isSignup && confirm !== password ? 'Passwords do not match' : null,
  };
  const errorFor = (field) => serverErrors[field] ?? (touched[field] ? clientErrors[field] : null);
  const strength = passwordStrength(password, email);

  // Editing a field clears the server's error for it.
  const update = (field, setter) => (event) => {
    setter(event.target.value);
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };
  const touch = (field) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setConfirm('');
    setTouched(EMPTY_TOUCHED);
    setServerErrors({});
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ email: true, password: true, confirm: true });
    if (Object.values(clientErrors).some(Boolean)) return;

    setBusy(true);
    setFormError('');
    try {
      await onSubmit(mode, email.trim(), password);
    } catch (err) {
      // Field-specific errors from the server, e.g. { email: ['An account with this email already exists'] }
      const fields = Object.fromEntries(
        Object.entries(err.details ?? {}).map(([field, messages]) => [field, messages[0]]),
      );
      if (Object.keys(fields).length > 0) setServerErrors(fields);
      else setFormError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      {/* noValidate: we show our own inline messages instead of the browser's popups */}
      <form className="auth" onSubmit={handleSubmit} noValidate>
        <div className="row">
          <div className="logo">AJ</div>
          <h1 className="brand">
            AI <span>Journal</span>
          </h1>
        </div>
        <div>
          <h2 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="muted small-text">
            Write privately. Ask your journal anything. Answers come only from your own entries.
          </p>
        </div>

        <Field label="Email" error={errorFor('email')}>
          <input
            type="email"
            value={email}
            onChange={update('email', setEmail)}
            onBlur={touch('email')}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(errorFor('email'))}
            className={errorFor('email') ? 'invalid' : ''}
            autoFocus
          />
        </Field>

        <Field label="Password" error={errorFor('password')}>
          <div className="password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={update('password', setPassword)}
              onBlur={touch('password')}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              aria-invalid={Boolean(errorFor('password'))}
              className={errorFor('password') ? 'invalid' : ''}
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {isSignup && password && (
            <div className="strength" data-score={strength.score}>
              <div className="strength-bar">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={strength.score >= step ? 'on' : ''} />
                ))}
              </div>
              <span className="strength-label">{strength.label}</span>
            </div>
          )}
          {isSignup && !password && (
            <span className="hint">Tip: a longer passphrase like &quot;mango-river-train-42&quot; is strong and easy to remember.</span>
          )}
        </Field>

        {isSignup && (
          <Field label="Confirm password" error={errorFor('confirm')}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={update('confirm', setConfirm)}
              onBlur={touch('confirm')}
              placeholder="Type it again"
              autoComplete="new-password"
              aria-invalid={Boolean(errorFor('confirm'))}
              className={errorFor('confirm') ? 'invalid' : ''}
            />
          </Field>
        )}

        {formError && <p className="error">{formError}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
        </button>
        <p className="muted small-text" style={{ textAlign: 'center' }}>
          {isSignup ? 'Already have an account? ' : 'No account yet? '}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </form>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
