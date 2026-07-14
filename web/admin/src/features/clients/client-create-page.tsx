import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../app/api-client';
import { isReauthCancelled } from '../../app/reauth';
import { FormField, inputClass } from '../../components/form-field';
import { useToast } from '../../components/toaster';
import { useCreateClient } from './api';
import {
  clientCreateSchema,
  DEFAULT_POLICY_VALUES,
  toCreateClientInput,
  type ClientCreateValues,
} from './client-form';
import { ClientPolicyFields } from './client-policy-fields';
import { CLIENT_TYPES } from './types';

export function ClientCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createClient = useCreateClient();

  const form = useForm<ClientCreateValues>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      ...DEFAULT_POLICY_VALUES,
      clientId: '',
      type: 'confidential',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createClient.mutate(toCreateClientInput(values), {
      onSuccess: (client) => {
        toast({
          title: 'Client created',
          description:
            client.type === 'confidential'
              ? 'Rotate a secret from the Credentials tab to finish setup.'
              : undefined,
        });
        void navigate(`/clients/${client.id}`);
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 409) {
          form.setError('clientId', {
            type: 'conflict',
            message: error.message,
          });

          return;
        }

        toast({
          title: 'Could not create client',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  });

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Create client</h1>
      <p className="mt-1 text-sm text-muted">
        The client ID and type are permanent once created.
      </p>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 rounded-card border border-line bg-surface p-6"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Client ID"
            error={form.formState.errors.clientId?.message}
          >
            <input
              className={`${inputClass} font-mono`}
              {...form.register('clientId')}
            />
          </FormField>
          <FormField label="Type" error={form.formState.errors.type?.message}>
            <select className={inputClass} {...form.register('type')}>
              {CLIENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="mt-4">
          <ClientPolicyFields form={form} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Link
            to="/clients"
            className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createClient.isPending}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {createClient.isPending ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>
    </section>
  );
}
