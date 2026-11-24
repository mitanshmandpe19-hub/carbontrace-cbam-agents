'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { USE_MOCK_API } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginAsDemo, requestMagicLink } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = React.useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = React.useState<string | null>(null);
  const [helperNotice, setHelperNotice] = React.useState<string | null>(null);

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  function validateFields(): boolean {
    const trimmedEmail = email.trim();
    const nextEmailErr = EMAIL_REGEX.test(trimmedEmail)
      ? null
      : 'Enter a valid email address.';
    const nextPasswordErr =
      password.length >= 6 ? null : 'Password must be at least 6 characters.';

    setEmailError(nextEmailErr);
    setPasswordError(nextPasswordErr);

    if (nextEmailErr) {
      emailRef.current?.focus();
      return false;
    }
    if (nextPasswordErr) {
      passwordRef.current?.focus();
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || demoLoading) return;
    setMagicLinkMessage(null);
    setHelperNotice(null);
    setAuthError(null);

    if (!validateFields()) return;

    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      router.push('/app');
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Login failed. Please check your details.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    setHelperNotice(null);
    setAuthError(null);
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Enter your email first to get a login link.');
      emailRef.current?.focus();
      return;
    }
    setMagicLinkLoading(true);
    try {
      const res = await requestMagicLink(trimmed);
      setMagicLinkMessage(res.message || 'Check your email');
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not send login link right now.'
      );
    } finally {
      setMagicLinkLoading(false);
    }
  }

  async function handleDemoUser() {
    if (submitting || demoLoading) return;
    setAuthError(null);
    setHelperNotice(null);
    setDemoLoading(true);
    try {
      await loginAsDemo();
      router.push('/app');
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Could not start demo session. Check backend server.'
      );
      setDemoLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--ct-bg)] px-4 py-12 text-[var(--ct-ink)]">
      {/* Subtle blurred pink-to-yellow corner glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'var(--ct-login-glow)' }}
      />

      {/* Top corner theme switch + back link */}
      <div className="fixed inset-x-4 top-4 z-20 mx-auto flex max-w-5xl items-center justify-between gap-3 sm:inset-x-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface)] px-3.5 py-2 text-[15px] font-semibold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)]"
        >
          Back home
        </Link>
        <ThemeToggle />
      </div>

      <main className="relative z-10 w-full max-w-md pt-10 sm:pt-4">
        <div className="rounded-3xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-6 shadow-[var(--ct-shadow-card)] sm:p-8">
          {/* Logo mark + Brand */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl ct-hero-gradient border border-[var(--ct-exporter-border)] text-base font-extrabold text-[var(--ct-exporter-text)]">
              CT
            </span>
            <span className="text-lg font-extrabold tracking-tight text-[var(--ct-ink)]">
              CarbonTrace
            </span>
          </div>

          <div className="mt-6 space-y-2">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[var(--ct-ink)]">
              Welcome back
            </h1>
            <p className="text-base leading-relaxed text-[var(--ct-ink-secondary)]">
              Log in to see your carbon report.
            </p>
          </div>

          {authError ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] px-4 py-3 text-[14px] font-semibold text-[var(--ct-verifier-text)]"
            >
              {authError}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[15px] font-semibold text-[var(--ct-ink)]"
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="demo@demofasteners.example"
                value={email}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  if (emailError && EMAIL_REGEX.test(val.trim())) {
                    setEmailError(null);
                  }
                }}
                aria-invalid={emailError ? 'true' : undefined}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                className="h-[52px] min-h-[52px] w-full rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-4 text-base text-[var(--ct-ink)] placeholder:text-[var(--ct-ink-secondary)] focus:border-[#D81B60] focus:outline-none focus:ring-3 focus:ring-[#D81B60]/35 focus-visible:outline-2 focus-visible:outline-[#D81B60] focus-visible:outline-offset-2"
              />
              {emailError ? (
                <p
                  id="login-email-error"
                  role="alert"
                  className="mt-1.5 text-[14px] font-semibold text-[var(--ct-verifier-text)]"
                >
                  {emailError}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[15px] font-semibold text-[var(--ct-ink)]"
              >
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPassword(val);
                    if (passwordError && val.length >= 6) {
                      setPasswordError(null);
                    }
                  }}
                  aria-invalid={passwordError ? 'true' : undefined}
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                  className="h-[52px] min-h-[52px] w-full rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] pl-4 pr-14 text-base text-[var(--ct-ink)] placeholder:text-[var(--ct-ink-secondary)] focus:border-[#D81B60] focus:outline-none focus:ring-3 focus:ring-[#D81B60]/35 focus-visible:outline-2 focus-visible:outline-[#D81B60] focus-visible:outline-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--ct-ink-secondary)] hover:bg-[var(--ct-surface-raised)] hover:text-[var(--ct-ink)] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {passwordError ? (
                <p
                  id="login-password-error"
                  role="alert"
                  className="mt-1.5 text-[14px] font-semibold text-[var(--ct-verifier-text)]"
                >
                  {passwordError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting || demoLoading}
              className="ct-gradient-btn mt-2 inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[#D81B60]/25 px-5 text-base font-bold shadow-sm cursor-pointer disabled:opacity-75"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Logging in…
                </>
              ) : (
                <>
                  Log in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={magicLinkLoading || submitting || demoLoading}
              className="inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-5 text-base font-bold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)] cursor-pointer disabled:opacity-75"
            >
              {magicLinkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="h-4 w-4" aria-hidden="true" />
              )}
              Email me a login link
            </button>

            {magicLinkMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] px-4 py-2.5 text-center text-[14px] font-semibold text-[var(--ct-outreach-text)]"
              >
                {magicLinkMessage}
              </p>
            ) : null}
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--ct-border)]" aria-hidden="true" />
            <span className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--ct-border)]" aria-hidden="true" />
          </div>

          <button
            type="button"
            onClick={handleDemoUser}
            disabled={submitting || demoLoading}
            className="inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--ct-exporter-border)] bg-[var(--ct-exporter-soft)] px-5 text-base font-bold text-[var(--ct-exporter-text)] hover:opacity-90 cursor-pointer disabled:opacity-60"
          >
            {demoLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Continue as demo user
              </>
            )}
          </button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setHelperNotice(
                  'Use demo@demofasteners.example or click Continue as demo user.'
                )
              }
              className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ct-ink-secondary)] hover:text-[var(--ct-ink)] hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() =>
                setHelperNotice(
                  'New exporter onboarding opens per company. Use Continue as demo user to test now.'
                )
              }
              className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ct-ink-secondary)] hover:text-[var(--ct-ink)] hover:underline cursor-pointer"
            >
              Create account
            </button>
          </div>

          {helperNotice ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-raised)] px-4 py-3 text-[14px] text-[var(--ct-ink-secondary)]"
            >
              {helperNotice}
            </p>
          ) : null}

          <p className="mt-5 border-t border-[var(--ct-border)] pt-4 text-center text-[14px] font-medium text-[var(--ct-ink-secondary)]">
            {USE_MOCK_API
              ? 'Demo mode: browser sample data only'
              : 'Demo mode: connected to live backend sample company'}
          </p>
        </div>
      </main>
    </div>
  );
}
