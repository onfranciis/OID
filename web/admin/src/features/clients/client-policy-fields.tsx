import { Controller, type UseFormReturn } from 'react-hook-form';
import { ChipInput } from '../../components/chip-input';
import { FormField, inputClass } from '../../components/form-field';
import type { ClientPolicyValues } from './client-form';

// Shared policy editor for the create form and the detail Policy tab. The form
// type is a superset in create (adds clientId/type), so we accept any form
// whose values extend ClientPolicyValues.
export function ClientPolicyFields<T extends ClientPolicyValues>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  // The generic form is structurally compatible with a ClientPolicyValues form
  // for the shared fields; cast once here to keep call sites clean.
  const policyForm = form as unknown as UseFormReturn<ClientPolicyValues>;
  const { register, control, formState, watch } = policyForm;
  const errors = formState.errors;
  const allowRefreshTokens = watch('allowRefreshTokens');

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" error={errors.name?.message}>
          <input className={inputClass} {...register('name')} />
        </FormField>
        <FormField label="Owner team" error={errors.ownerTeam?.message}>
          <input className={inputClass} {...register('ownerTeam')} />
        </FormField>
      </div>

      <Controller
        control={control}
        name="allowedScopes"
        render={({ field }) => (
          <FormField
            label="Allowed scopes"
            error={errors.allowedScopes?.message}
          >
            <ChipInput
              ariaLabel="Allowed scopes"
              placeholder="openid, profile, email"
              values={field.value}
              onChange={field.onChange}
            />
          </FormField>
        )}
      />

      <Controller
        control={control}
        name="allowedClaims"
        render={({ field }) => (
          <FormField
            label="Allowed claims"
            error={errors.allowedClaims?.message}
          >
            <ChipInput
              ariaLabel="Allowed claims"
              placeholder="sub, email, name"
              values={field.value}
              onChange={field.onChange}
            />
          </FormField>
        )}
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('requirePkce')} />
        Require PKCE (S256)
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Access token TTL (seconds)"
          error={errors.accessTokenTtlSeconds?.message}
        >
          <input
            type="number"
            className={inputClass}
            {...register('accessTokenTtlSeconds', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label="ID token TTL (seconds)"
          error={errors.idTokenTtlSeconds?.message}
        >
          <input
            type="number"
            className={inputClass}
            {...register('idTokenTtlSeconds', { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('allowRefreshTokens')} />
        Allow refresh tokens
      </label>

      {allowRefreshTokens ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Refresh idle TTL (seconds)"
            error={errors.refreshTokenIdleTtlSeconds?.message}
          >
            <input
              type="number"
              className={inputClass}
              {...register('refreshTokenIdleTtlSeconds', {
                setValueAs: (value) => (value === '' ? null : Number(value)),
              })}
            />
          </FormField>
          <FormField
            label="Refresh absolute TTL (seconds)"
            error={errors.refreshTokenAbsoluteTtlSeconds?.message}
          >
            <input
              type="number"
              className={inputClass}
              {...register('refreshTokenAbsoluteTtlSeconds', {
                setValueAs: (value) => (value === '' ? null : Number(value)),
              })}
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
