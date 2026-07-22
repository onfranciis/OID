import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { LOGIN_PATH } from '../../app/navigation';
import { useSignedInRedirect } from '../../app/pre-session';
import { FormField, inputClass } from '../../components/form-field';
import { FullPageMessage } from '../../components/full-page';
import { useToast } from '../../components/toaster';
import {
  confirmPasswordReset,
  getPasswordReset,
  PasswordResetError,
} from './api';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const { isChecking, isSignedIn } = useSignedInRedirect('/admin');
  const { token = '' } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const resetQuery = useQuery({
    queryKey: ['password-reset', token],
    queryFn: () => getPasswordReset(token),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await confirmPasswordReset(token, values.password);
      setSubmitted(true);
    } catch (error) {
      toast({
        title: 'Could not reset your password',
        description:
          error instanceof PasswordResetError
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'danger',
      });
    }
  });

  if (isChecking || isSignedIn) {
    return (
      <FullPageMessage title="Internal ID Admin">
        <p className="text-sm text-muted">
          {isSignedIn ? 'Redirecting…' : 'Checking your session…'}
        </p>
      </FullPageMessage>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-page p-6 font-sans text-ink">
      <main className="w-full max-w-100 rounded-[20px] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-surface">
            ID
          </span>
          <span className="text-lg font-bold">Internal ID</span>
        </div>

        {submitted ? (
          <>
            <h1 className="text-2xl font-semibold">Password updated</h1>
            <p className="mt-1.5 text-sm text-muted">
              Your password has been changed. Sign in with your new password.
            </p>
            <a
              href={LOGIN_PATH}
              className="mt-6 flex items-center justify-center gap-1.5 rounded-card bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Go to sign in
            </a>
          </>
        ) : resetQuery.isPending ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : resetQuery.isError ? (
          <>
            <h1 className="text-2xl font-semibold">Link not available</h1>
            <p
              role="alert"
              className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
            >
              {resetQuery.error instanceof PasswordResetError
                ? resetQuery.error.message
                : 'This reset link is invalid or has expired.'}
            </p>
            <a
              href={LOGIN_PATH}
              className="mt-6 inline-block text-sm font-semibold text-accent underline"
            >
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1.5 text-sm text-muted">
              Choose a new password for {resetQuery.data.email}.
            </p>

            <form
              onSubmit={(event) => void onSubmit(event)}
              className="mt-6 grid gap-4"
              noValidate
            >
              <FormField
                label="New password"
                error={form.formState.errors.password?.message}
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={`${inputClass} w-full pl-9`}
                    {...form.register('password')}
                  />
                </div>
              </FormField>
              <FormField
                label="Confirm password"
                error={form.formState.errors.confirmPassword?.message}
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={`${inputClass} w-full pl-9`}
                    {...form.register('confirmPassword')}
                  />
                </div>
              </FormField>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-card bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {form.formState.isSubmitting
                  ? 'Setting password…'
                  : 'Set password'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
