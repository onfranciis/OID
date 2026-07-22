import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyRound,
  Lock,
  Monitor,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../app/api-client';
import { isReauthCancelled } from '../../app/reauth';
import { useTheme, type ThemePreference } from '../../app/theme';
import { FormField, inputClass } from '../../components/form-field';
import { useToast } from '../../components/toaster';
import { useChangePassword } from './api';

const APPEARANCE_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted">
        Choose how the admin console looks on this device.
      </p>
      <div
        role="group"
        aria-label="Theme"
        className="mt-4 inline-flex rounded-card border border-line p-1"
      >
        {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = preference === value;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setPreference(value)}
              className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm font-medium ${
                selected
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function AccountPage() {
  const { toast } = useToast();
  const changePassword = useChangePassword();

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          form.reset();
          toast({
            title: 'Password changed',
            description: 'Use your new password next time you sign in.',
          });
        },
        onError: (error) => {
          if (isReauthCancelled(error)) {
            return;
          }

          toast({
            title: 'Could not change password',
            description:
              error instanceof ApiError
                ? error.message
                : 'Something went wrong. Please try again.',
            variant: 'danger',
          });
        },
      },
    );
  });

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-muted">
        Update the password you use to sign in.
      </p>

      <div className="mt-6">
        <AppearanceSection />
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 grid gap-4 rounded-card border border-line bg-surface p-6"
        noValidate
      >
        <FormField
          label="Current password"
          error={form.formState.errors.currentPassword?.message}
        >
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="password"
              autoComplete="current-password"
              className={`${inputClass} w-full pl-9`}
              {...form.register('currentPassword')}
            />
          </div>
        </FormField>
        <FormField
          label="New password"
          error={form.formState.errors.newPassword?.message}
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
              {...form.register('newPassword')}
            />
          </div>
        </FormField>
        <FormField
          label="Confirm new password"
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
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {changePassword.isPending ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  );
}
