import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Lock, LogIn, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { FORGOT_PASSWORD_PATH, hardNavigate } from '../../app/navigation';
import { FormField, inputClass } from '../../components/form-field';
import { useToast } from '../../components/toaster';
import { initLogin, LoginError, safeReturnTo, submitLogin } from './api';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const initQuery = useQuery({
    queryKey: ['auth', 'login-init'],
    queryFn: initLogin,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!initQuery.data) {
      return;
    }

    setSubmitting(true);

    try {
      await submitLogin({
        email: values.email,
        password: values.password,
        csrfToken: initQuery.data.csrfToken,
        returnTo,
      });
      // Only reached on success: full navigation so the app re-bootstraps with
      // the new session cookie.
      hardNavigate(returnTo);
    } catch (error) {
      // Invalid credentials (and CSRF / rate-limit failures) stay on the page
      // and surface as a toast — no navigation happens.
      toast({
        title: 'Sign-in failed',
        description:
          error instanceof LoginError
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'danger',
      });
      setSubmitting(false);
    }
  });

  return (
    <div className="grid min-h-screen place-items-center bg-page p-6 font-sans text-ink">
      <main className="w-full max-w-100 rounded-[20px] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-surface">
            ID
          </span>
          <span className="text-lg font-bold">Internal ID</span>
        </div>

        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted">
          Use your Internal ID email and password to continue.
        </p>

        {initQuery.isError ? (
          <p
            role="alert"
            className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
          >
            Could not start sign-in.{' '}
            <button
              type="button"
              onClick={() => void initQuery.refetch()}
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </p>
        ) : null}

        <form
          onSubmit={(event) => void onSubmit(event)}
          className="mt-6 grid gap-4"
          noValidate
        >
          <FormField label="Email" error={form.formState.errors.email?.message}>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                className={`${inputClass} w-full pl-9`}
                {...form.register('email')}
              />
            </div>
          </FormField>
          <FormField
            label="Password"
            error={form.formState.errors.password?.message}
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${inputClass} w-full pl-9`}
                {...form.register('password')}
              />
            </div>
          </FormField>
          <a
            href={FORGOT_PASSWORD_PATH}
            className="-mt-2 justify-self-end text-xs font-semibold text-accent underline"
          >
            Forgot password?
          </a>
          <button
            type="submit"
            disabled={submitting || initQuery.isPending}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-card bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Hosted by the identity provider.
        </p>
      </main>
    </div>
  );
}
