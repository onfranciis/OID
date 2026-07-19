import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CircleCheck,
  CirclePause,
  Mail,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { isReauthCancelled } from '../../app/reauth';
import { useSession } from '../../app/session';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { useToast } from '../../components/toaster';
import { formatDate, formatDateTime } from '../../lib/format';
import { useGroupsList } from '../groups/api';
import {
  useAddUserToGroup,
  useInviteUser,
  useRemoveUserFromGroup,
  useSetUserStatus,
  useUpdateUser,
  useUserDetail,
} from './api';
import { userStatusTone, type UserDetail, type UserStatus } from './types';
import { applyConflictToForm } from './user-create-page';
import {
  toFormValues,
  toCreateUserInput,
  userFormSchema,
  type UserFormValues,
} from './user-form';
import { UserFormFields } from './user-fields';

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const query = useUserDetail(userId);

  if (query.isPending) {
    return <p className="text-sm text-muted">Loading user…</p>;
  }

  if (query.isError) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">User not found</h1>
        <p className="mt-2 text-sm text-muted">{query.error.message}</p>
        <Link
          to="/users"
          className="mt-6 inline-flex items-center gap-1.5 rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Users
        </Link>
      </section>
    );
  }

  const user = query.data;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{user.displayName}</h1>
        <StatusBadge label={user.status} tone={userStatusTone(user.status)} />
      </div>
      <p className="mt-1 text-sm text-muted">{user.email}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProfilePanel user={user} />
        <div className="grid content-start gap-6">
          <LifecyclePanel user={user} />
          <GroupsPanel user={user} />
          <ActivityPanel user={user} />
        </div>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfilePanel({ user }: { user: UserDetail }) {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const updateUser = useUpdateUser(user.id);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    values: toFormValues(user),
  });

  const onSubmit = form.handleSubmit((values) => {
    updateUser.mutate(toCreateUserInput(values), {
      onSuccess: () => {
        toast({ title: 'Profile updated' });
        setEditing(false);
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        if (!applyConflictToForm(error, form.setError)) {
          toast({
            title: 'Could not update profile',
            description: error.message,
            variant: 'danger',
          });
        }
      },
    });
  });

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Profile</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-card border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      <div className="mt-4">
        {editing ? (
          <form onSubmit={(event) => void onSubmit(event)} noValidate>
            <UserFormFields form={form} />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  form.reset(toFormValues(user));
                  setEditing(false);
                }}
                className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateUser.isPending}
                className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
              >
                {updateUser.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ProfileEntry label="Email">
              {user.email}{' '}
              <span className="text-xs text-muted">
                ({user.emailVerifiedAt ? 'verified' : 'unverified'})
              </span>
            </ProfileEntry>
            <ProfileEntry label="Username">{user.username ?? '—'}</ProfileEntry>
            <ProfileEntry label="Given name">
              {user.givenName ?? '—'}
            </ProfileEntry>
            <ProfileEntry label="Family name">
              {user.familyName ?? '—'}
            </ProfileEntry>
            <ProfileEntry label="Profile type">{user.profileType}</ProfileEntry>
            <ProfileEntry label="Created">
              {formatDate(user.createdAt)}
            </ProfileEntry>
            <ProfileEntry label="Updated">
              {formatDateTime(user.updatedAt)}
            </ProfileEntry>
            <ProfileEntry label="Deactivated">
              {formatDateTime(user.deactivatedAt)}
            </ProfileEntry>
          </dl>
        )}
      </div>
    </section>
  );
}

function ProfileEntry({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

interface StatusTransition {
  label: string;
  target: UserStatus;
  destructive: boolean;
  icon: typeof CircleCheck;
}

function availableTransitions(status: UserStatus): StatusTransition[] {
  switch (status) {
    case 'pending':
      return [
        {
          label: 'Activate',
          target: 'active',
          destructive: false,
          icon: CircleCheck,
        },
        {
          label: 'Deactivate',
          target: 'deactivated',
          destructive: true,
          icon: Ban,
        },
      ];
    case 'active':
      return [
        {
          label: 'Suspend',
          target: 'suspended',
          destructive: true,
          icon: CirclePause,
        },
        {
          label: 'Deactivate',
          target: 'deactivated',
          destructive: true,
          icon: Ban,
        },
      ];
    case 'suspended':
      return [
        {
          label: 'Reactivate',
          target: 'active',
          destructive: false,
          icon: CircleCheck,
        },
        {
          label: 'Deactivate',
          target: 'deactivated',
          destructive: true,
          icon: Ban,
        },
      ];
    case 'deactivated':
      return [
        {
          label: 'Reactivate',
          target: 'active',
          destructive: false,
          icon: CircleCheck,
        },
      ];
  }
}

function LifecyclePanel({ user }: { user: UserDetail }) {
  const { toast } = useToast();
  const session = useSession();
  const setStatus = useSetUserStatus(user.id);
  const inviteUser = useInviteUser(user.id);
  const [pendingTransition, setPendingTransition] =
    useState<StatusTransition | null>(null);
  const isSelf = user.id === session.user.id;

  const sendInvite = () => {
    inviteUser.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: 'Invite sent',
          description: `${user.email} can now set their password.`,
        });
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        toast({
          title: 'Could not send invite',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  };

  const runTransition = (transition: StatusTransition) => {
    setStatus.mutate(transition.target, {
      onSuccess: (result) => {
        const revoked =
          result.revokedProviderSessionCount !== undefined ||
          result.revokedRefreshTokenCount !== undefined;

        toast({
          title: `Status set to ${transition.target}`,
          description: revoked
            ? `Revoked ${result.revokedProviderSessionCount ?? 0} provider sessions and ${result.revokedRefreshTokenCount ?? 0} refresh tokens.`
            : undefined,
        });
        setPendingTransition(null);
      },
      onError: (error) => {
        setPendingTransition(null);

        if (isReauthCancelled(error)) {
          return;
        }

        toast({
          title: 'Could not change status',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  };

  return (
    <Panel title="Lifecycle">
      <p className="text-sm text-muted">
        Current status:{' '}
        <StatusBadge label={user.status} tone={userStatusTone(user.status)} />
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {availableTransitions(user.status).map((transition) => {
          const Icon = transition.icon;

          return (
            <button
              key={transition.target}
              type="button"
              disabled={setStatus.isPending}
              onClick={() =>
                transition.destructive
                  ? setPendingTransition(transition)
                  : runTransition(transition)
              }
              className={`flex items-center gap-1.5 rounded-card border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                transition.destructive
                  ? 'border-danger/40 text-danger hover:bg-danger/10'
                  : 'border-accent/40 text-accent hover:bg-accent/10'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {transition.label}
            </button>
          );
        })}
        {user.status !== 'deactivated' && !isSelf ? (
          <button
            type="button"
            disabled={inviteUser.isPending}
            onClick={sendInvite}
            className="flex items-center gap-1.5 rounded-card border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {inviteUser.isPending ? 'Sending invite…' : 'Send invite'}
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTransition(null);
          }
        }}
        title={`${pendingTransition?.label ?? ''} ${user.displayName}?`}
        description={
          pendingTransition?.target === 'deactivated' ? (
            <p>
              Deactivation immediately revokes every provider session and
              refresh token this user holds. OIDC sign-ins stop working until
              the user is reactivated.
            </p>
          ) : (
            <p>
              Suspension blocks new sign-ins while keeping the account intact.
            </p>
          )
        }
        confirmLabel={`${pendingTransition?.label ?? 'Confirm'} user`}
        tone="danger"
        pending={setStatus.isPending}
        onConfirm={() => {
          if (pendingTransition) {
            runTransition(pendingTransition);
          }
        }}
      />
    </Panel>
  );
}

function GroupsPanel({ user }: { user: UserDetail }) {
  const { toast } = useToast();
  const session = useSession();
  const groupsQuery = useGroupsList();
  const addToGroup = useAddUserToGroup(user.id);
  const removeFromGroup = useRemoveUserFromGroup(user.id);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [removingGroup, setRemovingGroup] = useState<{
    id: string;
    slug: string;
    displayName: string;
  } | null>(null);

  const memberGroupIds = new Set(user.groups.map((group) => group.id));
  const availableGroups =
    groupsQuery.data?.items.filter((group) => !memberGroupIds.has(group.id)) ??
    [];

  // Removing your own membership in the bootstrap admin group can lock you
  // out of this console; require typed confirmation.
  const selfLockout =
    removingGroup !== null &&
    removingGroup.slug === session.adminGroupSlug &&
    user.id === session.user.id;

  const mutationError = (title: string) => (error: Error) => {
    setRemovingGroup(null);

    if (isReauthCancelled(error)) {
      return;
    }

    toast({ title, description: error.message, variant: 'danger' });
  };

  return (
    <Panel title="Groups">
      {user.groups.length === 0 ? (
        <p className="text-sm text-muted">No group memberships.</p>
      ) : (
        <ul className="grid gap-2">
          {user.groups.map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{group.displayName}</span>{' '}
                <span className="text-xs text-muted">({group.slug})</span>
              </span>
              <button
                type="button"
                onClick={() => setRemovingGroup(group)}
                className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={selectedGroupId}
          onChange={(event) => setSelectedGroupId(event.target.value)}
          aria-label="Add to group"
          className={`${inputClass} flex-1`}
        >
          <option value="">Select a group…</option>
          {availableGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.displayName}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedGroupId || addToGroup.isPending}
          onClick={() =>
            addToGroup.mutate(selectedGroupId, {
              onSuccess: () => {
                toast({ title: 'Added to group' });
                setSelectedGroupId('');
              },
              onError: mutationError('Could not add to group'),
            })
          }
          className="flex items-center gap-1.5 rounded-card border border-accent/40 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addToGroup.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      <ConfirmDialog
        open={removingGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemovingGroup(null);
          }
        }}
        title={`Remove from ${removingGroup?.displayName ?? 'group'}?`}
        description={
          selfLockout ? (
            <p>
              This is your own membership in the bootstrap admin group. Removing
              it revokes your access to this console immediately.
            </p>
          ) : (
            <p>
              The user loses any access this group membership grants through
              client applications.
            </p>
          )
        }
        confirmLabel="Remove membership"
        tone="danger"
        typedConfirmation={selfLockout ? removingGroup.slug : undefined}
        pending={removeFromGroup.isPending}
        onConfirm={() => {
          if (removingGroup) {
            removeFromGroup.mutate(removingGroup.id, {
              onSuccess: () => {
                toast({ title: 'Membership removed' });
                setRemovingGroup(null);
              },
              onError: mutationError('Could not remove membership'),
            });
          }
        }}
      />
    </Panel>
  );
}

function ActivityPanel({ user }: { user: UserDetail }) {
  return (
    <Panel title="Recent activity">
      <p className="text-sm text-muted">
        Audit events involving this user, in the Audit section:
      </p>
      <ul className="mt-3 grid gap-2 text-sm">
        <li>
          <Link
            to={`/audit?targetUserId=${user.id}`}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            Events targeting this user
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link
            to={`/audit?actorUserId=${user.id}`}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            Events performed by this user
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </Panel>
  );
}
