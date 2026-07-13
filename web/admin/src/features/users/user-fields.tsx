import type { UseFormReturn } from 'react-hook-form';
import { FormField, inputClass } from '../../components/form-field';
import { USER_PROFILE_TYPES } from './types';
import type { UserFormValues } from './user-form';

// Shared fields between the create form and the profile edit form.
export function UserFormFields({
  form,
}: {
  form: UseFormReturn<UserFormValues>;
}) {
  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Email" error={errors.email?.message}>
        <input type="email" className={inputClass} {...register('email')} />
      </FormField>
      <FormField label="Display name" error={errors.displayName?.message}>
        <input className={inputClass} {...register('displayName')} />
      </FormField>
      <FormField label="Given name" error={errors.givenName?.message}>
        <input className={inputClass} {...register('givenName')} />
      </FormField>
      <FormField label="Family name" error={errors.familyName?.message}>
        <input className={inputClass} {...register('familyName')} />
      </FormField>
      <FormField label="Username" error={errors.username?.message}>
        <input className={inputClass} {...register('username')} />
      </FormField>
      <FormField label="Profile type" error={errors.profileType?.message}>
        <select className={inputClass} {...register('profileType')}>
          {USER_PROFILE_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}
