import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LOGIN_PATH } from '../../app/navigation';
import { useSignedInRedirect } from '../../app/pre-session';
import { FormField, inputClass } from '../../components/form-field';
import { FullPageMessage } from '../../components/full-page';
import { requestPasswordReset } from './api';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { isChecking, isSignedIn } = useSignedInRedirect('/admin');
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await requestPasswordReset(values.email);
    setSubmitted(true);
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
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="mt-1.5 text-sm text-muted">
              If an account exists for that email, we&apos;ve sent a link to
              reset your password.
            </p>
            <a
              href={LOGIN_PATH}
              className="mt-6 inline-block text-sm font-semibold text-accent underline"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Forgot your password?</h1>
            <p className="mt-1.5 text-sm text-muted">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>

            <form
              onSubmit={(event) => void onSubmit(event)}
              className="mt-6 grid gap-4"
              noValidate
            >
              <FormField
                label="Email"
                error={form.formState.errors.email?.message}
              >
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
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-card bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <a
              href={LOGIN_PATH}
              className="mt-6 block text-center text-sm font-semibold text-accent underline"
            >
              Back to sign in
            </a>
          </>
        )}
      </main>
    </div>
  );
}
