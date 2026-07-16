import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../app/api-client';
import { isReauthCancelled } from '../../app/reauth';
import { useSession } from '../../app/session';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { FormField, inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { useToast } from '../../components/toaster';
import { userStatusTone } from '../users/types';
import {
  useAddGroupMember,
  useDeleteGroup,
  useGroupDetail,
  useRemoveGroupMember,
  useUpdateGroup,
} from './api';
import {
  groupFormSchema,
  toGroupFormValues,
  toGroupInput,
  type GroupFormValues,
} from './group-form';
import type { GroupDetail, GroupMember } from './types';
import { UserPicker } from './user-picker';

export function GroupDetailPage() {
  const { groupId = '' } = useParams();
  const query = useGroupDetail(groupId);

  if (query.isPending) {
    return <p className="text-sm text-muted">Loading group…</p>;
  }

  if (query.isError) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Group not found</h1>
        <p className="mt-2 text-sm text-muted">{query.error.message}</p>
        <Link
          to="/groups"
          className="mt-6 inline-block rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent"
        >
          Back to Groups
        </Link>
      </section>
    );
  }

  const group = query.data;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{group.displayName}</h1>
        <span className="font-mono text-sm text-muted">{group.slug}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MetadataPanel group={group} />
        <MembersPanel group={group} />
      </div>

      <DangerZone group={group} />
    </section>
  );
}

function DangerZone({ group }: { group: GroupDetail }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const deleteGroup = useDeleteGroup(group.id);
  const [confirming, setConfirming] = useState(false);
  const hasMembers = group.members.length > 0;

  return (
    <section className="mt-6 rounded-card border border-danger/30 bg-surface p-5">
      <h2 className="text-base font-semibold text-danger">Danger zone</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          {hasMembers
            ? 'This group still has members. Remove all members before it can be deleted.'
            : 'Permanently delete this empty group. This cannot be undone.'}
        </p>
        <button
          type="button"
          disabled={hasMembers || deleteGroup.isPending}
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded-card border border-danger/40 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete group
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${group.displayName}?`}
        description={
          <p>
            The group <span className="font-mono">{group.slug}</span> will be
            permanently removed. This cannot be undone.
          </p>
        }
        confirmLabel="Delete group"
        tone="danger"
        pending={deleteGroup.isPending}
        onConfirm={() => {
          deleteGroup.mutate(undefined, {
            onSuccess: () => {
              toast({ title: 'Group deleted' });
              void navigate('/groups');
            },
            onError: (error) => {
              setConfirming(false);

              if (!isReauthCancelled(error)) {
                toast({
                  title: 'Could not delete group',
                  description: error.message,
                  variant: 'danger',
                });
              }
            },
          });
        }}
      />
    </section>
  );
}

function MetadataPanel({ group }: { group: GroupDetail }) {
  const { toast } = useToast();
  const session = useSession();
  const updateGroup = useUpdateGroup(group.id);
  const isAdminGroup = group.slug === session.adminGroupSlug;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    values: toGroupFormValues(group),
  });

  const slugChanged = form.watch('slug').trim().toLowerCase() !== group.slug;

  const onSubmit = form.handleSubmit((values) => {
    updateGroup.mutate(toGroupInput(values), {
      onSuccess: () => toast({ title: 'Group updated' }),
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 409) {
          form.setError('slug', { type: 'conflict', message: error.message });

          return;
        }

        toast({
          title: 'Could not update group',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  });

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Metadata</h2>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-4 grid gap-4"
        noValidate
      >
        <FormField label="Slug" error={form.formState.errors.slug?.message}>
          <input
            className={`${inputClass} font-mono`}
            {...form.register('slug')}
          />
        </FormField>
        {isAdminGroup && slugChanged ? (
          <p className="rounded-card border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            This is the bootstrap admin group. Its slug is referenced by
            <span className="font-mono"> BOOTSTRAP_ADMIN_GROUP_SLUG</span>;
            renaming it can revoke admin access for everyone until the
            environment is updated to match.
          </p>
        ) : null}
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
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateGroup.isPending || !form.formState.isDirty}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {updateGroup.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

function MembersPanel({ group }: { group: GroupDetail }) {
  const { toast } = useToast();
  const session = useSession();
  const addMember = useAddGroupMember(group.id);
  const removeMember = useRemoveGroupMember(group.id);
  const [removing, setRemoving] = useState<GroupMember | null>(null);

  const isAdminGroup = group.slug === session.adminGroupSlug;
  const memberIds = new Set(group.members.map((member) => member.id));

  // Removing yourself from the bootstrap admin group can lock you out.
  const selfLockout =
    removing !== null && isAdminGroup && removing.id === session.user.id;

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">
        Members{' '}
        <span className="text-sm font-normal text-muted">
          ({group.members.length})
        </span>
      </h2>

      {group.members.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No members yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {group.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line px-3 py-2 text-sm"
            >
              <Link
                to={`/users/${member.id}`}
                className="min-w-0 hover:text-accent"
              >
                <span className="font-medium">{member.displayName}</span>{' '}
                <span className="text-xs text-muted">{member.email}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge
                  label={member.status}
                  tone={userStatusTone(member.status)}
                />
                <button
                  type="button"
                  onClick={() => setRemoving(member)}
                  className="text-xs font-semibold text-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <UserPicker
          excludeIds={memberIds}
          disabled={addMember.isPending}
          onPick={(userId) =>
            addMember.mutate(userId, {
              onSuccess: () => toast({ title: 'Member added' }),
              onError: (error) => {
                if (!isReauthCancelled(error)) {
                  toast({
                    title: 'Could not add member',
                    description: error.message,
                    variant: 'danger',
                  });
                }
              },
            })
          }
        />
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title={`Remove ${removing?.displayName ?? 'member'}?`}
        description={
          selfLockout ? (
            <p>
              You are removing your own membership in the bootstrap admin group.
              This revokes your access to this console immediately.
            </p>
          ) : (
            <p>
              The user loses any access this group grants through client
              applications.
            </p>
          )
        }
        confirmLabel="Remove member"
        tone="danger"
        typedConfirmation={selfLockout ? group.slug : undefined}
        pending={removeMember.isPending}
        onConfirm={() => {
          if (removing) {
            removeMember.mutate(removing.id, {
              onSuccess: () => {
                toast({ title: 'Member removed' });
                setRemoving(null);
              },
              onError: (error) => {
                setRemoving(null);

                if (!isReauthCancelled(error)) {
                  toast({
                    title: 'Could not remove member',
                    description: error.message,
                    variant: 'danger',
                  });
                }
              },
            });
          }
        }}
      />

      <p className="mt-4 text-sm">
        <Link
          to={`/audit?eventType=admin.group.membership`}
          className="font-semibold text-accent hover:underline"
        >
          View membership changes in Audit
        </Link>
      </p>
    </section>
  );
}
