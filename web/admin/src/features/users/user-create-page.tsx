import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormSetError } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../app/api-client';
import { isReauthCancelled } from '../../app/reauth';
import { useToast } from '../../components/toaster';
import { useCreateUser } from './api';
import {
  toCreateUserInput,
  userFormSchema,
  type UserFormValues,
} from './user-form';
import { UserFormFields } from './user-fields';

// Backend 409s carry which identity field collided; map them onto the form.
export function applyConflictToForm(
  error: unknown,
  setError: UseFormSetError<UserFormValues>,
): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false;
  }

  const message = error.message;

  if (message.toLowerCase().includes('email')) {
    setError('email', { type: 'conflict', message });

    return true;
  }

  if (message.toLowerCase().includes('username')) {
    setError('username', { type: 'conflict', message });

    return true;
  }

  return false;
}

export function UserCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createUser = useCreateUser();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      displayName: '',
      givenName: '',
      familyName: '',
      username: '',
      profileType: 'employee',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createUser.mutate(toCreateUserInput(values), {
      onSuccess: (user) => {
        toast({
          title: 'User created',
          description: `${user.displayName} starts in pending status.`,
        });
        void navigate(`/users/${user.id}`);
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        if (!applyConflictToForm(error, form.setError)) {
          toast({
            title: 'Could not create user',
            description: error.message,
            variant: 'danger',
          });
        }
      },
    });
  });

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Create user</h1>
      <p className="mt-1 text-sm text-muted">
        New users start in pending status and activate once credentials are
        established.
      </p>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 rounded-card border border-line bg-surface p-6"
        noValidate
      >
        <UserFormFields form={form} />
        <div className="mt-6 flex justify-end gap-2">
          <Link
            to="/users"
            className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createUser.isPending}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {createUser.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </section>
  );
}
