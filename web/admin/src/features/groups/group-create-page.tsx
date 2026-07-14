import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../app/api-client';
import { isReauthCancelled } from '../../app/reauth';
import { FormField, inputClass } from '../../components/form-field';
import { useToast } from '../../components/toaster';
import { useCreateGroup } from './api';
import {
  groupFormSchema,
  toGroupInput,
  type GroupFormValues,
} from './group-form';

export function GroupCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createGroup = useCreateGroup();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { slug: '', displayName: '', description: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    createGroup.mutate(toGroupInput(values), {
      onSuccess: (group) => {
        toast({ title: 'Group created' });
        void navigate(`/groups/${group.id}`);
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 409) {
          form.setError('slug', { type: 'conflict', message: error.message });

          return;
        }

        toast({
          title: 'Could not create group',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  });

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Create group</h1>
      <p className="mt-1 text-sm text-muted">
        Group memberships can grant application access and drive claim release.
      </p>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 grid gap-4 rounded-card border border-line bg-surface p-6"
        noValidate
      >
        <FormField label="Slug" error={form.formState.errors.slug?.message}>
          <input
            className={`${inputClass} font-mono`}
            {...form.register('slug')}
          />
        </FormField>
        <FormField
          label="Display name"
          error={form.formState.errors.displayName?.message}
        >
          <input className={inputClass} {...form.register('displayName')} />
        </FormField>
        <FormField
          label="Description"
          error={form.formState.errors.description?.message}
        >
          <textarea
            className={inputClass}
            rows={3}
            {...form.register('description')}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Link
            to="/groups"
            className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createGroup.isPending}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {createGroup.isPending ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </section>
  );
}
