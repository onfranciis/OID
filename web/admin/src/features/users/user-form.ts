import { z } from 'zod';
import type { AdminCreateUserInput, UserDetail } from './types';

// Client-side mirror of AdminUserService validation: email and displayName are
// required (trimmed non-empty); the rest are optional and empty strings become
// null, matching the backend normalizeOptional helper.
export const userFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
  displayName: z.string().trim().min(1, 'Display name is required.'),
  givenName: z.string().trim(),
  familyName: z.string().trim(),
  username: z.string().trim(),
  profileType: z.enum(['employee', 'contractor', 'service']),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export function toCreateUserInput(
  values: UserFormValues,
): AdminCreateUserInput {
  return {
    email: values.email,
    displayName: values.displayName,
    givenName: values.givenName || null,
    familyName: values.familyName || null,
    username: values.username || null,
    profileType: values.profileType,
  };
}

export function toFormValues(user: UserDetail): UserFormValues {
  return {
    email: user.email,
    displayName: user.displayName,
    givenName: user.givenName ?? '',
    familyName: user.familyName ?? '',
    username: user.username ?? '',
    profileType: user.profileType,
  };
}
