import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { isReauthCancelled } from '../../app/reauth';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { FormField, inputClass } from '../../components/form-field';
import { RevealSecret } from '../../components/reveal-secret';
import { StatusBadge } from '../../components/status-badge';
import { Tabs } from '../../components/tabs';
import { useToast } from '../../components/toaster';
import { formatDate, formatDateTime } from '../../lib/format';
import {
  useAddRedirectUri,
  useClientDetail,
  useRemoveRedirectUri,
  useRotateClientSecret,
  useSetClientStatus,
  useUpdateClient,
} from './api';
import {
  clientPolicySchema,
  toPolicyValues,
  toUpdateClientInput,
  type ClientPolicyValues,
} from './client-form';
import { ClientPolicyFields } from './client-policy-fields';
import { clientStatusTone, type ClientDetail } from './types';

export function ClientDetailPage() {
  const { clientRecordId = '' } = useParams();
  const query = useClientDetail(clientRecordId);

  if (query.isPending) {
    return <p className="text-sm text-muted">Loading client…</p>;
  }

  if (query.isError) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Client not found</h1>
        <p className="mt-2 text-sm text-muted">{query.error.message}</p>
        <Link
          to="/clients"
          className="mt-6 inline-block rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent"
        >
          Back to Clients
        </Link>
      </section>
    );
  }

  const client = query.data;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <StatusBadge
          label={client.status}
          tone={clientStatusTone(client.status)}
        />
      </div>
      <p className="mt-1 font-mono text-sm text-muted">{client.clientId}</p>

      <div className="mt-6">
        <Tabs
          tabs={[
            {
              id: 'policy',
              label: 'Policy',
              content: <PolicyTab client={client} />,
            },
            {
              id: 'redirect-uris',
              label: 'Redirect URIs',
              content: <RedirectUrisTab client={client} />,
            },
            {
              id: 'credentials',
              label: 'Credentials',
              content: <CredentialsTab client={client} />,
            },
            {
              id: 'status',
              label: 'Status',
              content: <StatusTab client={client} />,
            },
            {
              id: 'activity',
              label: 'Activity',
              content: <ActivityTab client={client} />,
            },
          ]}
        />
      </div>
    </section>
  );
}

function PolicyTab({ client }: { client: ClientDetail }) {
  const { toast } = useToast();
  const updateClient = useUpdateClient(client.id);

  const form = useForm<ClientPolicyValues>({
    resolver: zodResolver(clientPolicySchema),
    values: toPolicyValues(client),
  });

  const onSubmit = form.handleSubmit((values) => {
    updateClient.mutate(toUpdateClientInput(values), {
      onSuccess: () => toast({ title: 'Policy updated' }),
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        toast({
          title: 'Could not update policy',
          description: error.message,
          variant: 'danger',
        });
      },
    });
  });

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="max-w-2xl"
      noValidate
    >
      <ClientPolicyFields form={form} />
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={updateClient.isPending || !form.formState.isDirty}
          className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {updateClient.isPending ? 'Saving…' : 'Save policy'}
        </button>
      </div>
    </form>
  );
}

function RedirectUrisTab({ client }: { client: ClientDetail }) {
  const { toast } = useToast();
  const [uri, setUri] = useState('');
  const [uriError, setUriError] = useState<string | null>(null);
  const addRedirectUri = useAddRedirectUri(client.id);
  const removeRedirectUri = useRemoveRedirectUri(client.id);
  const [removing, setRemoving] = useState<{ id: string; uri: string } | null>(
    null,
  );

  const validate = (value: string): string | null => {
    let parsed: URL;

    try {
      parsed = new URL(value.trim());
    } catch {
      return 'Redirect URI must be an absolute URL.';
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'Redirect URI must use http or https.';
    }

    if (parsed.hash.length > 0) {
      return 'Redirect URI must not include a fragment.';
    }

    return null;
  };

  const submit = () => {
    const validationError = validate(uri);

    if (validationError) {
      setUriError(validationError);

      return;
    }

    addRedirectUri.mutate(uri.trim(), {
      onSuccess: () => {
        toast({ title: 'Redirect URI added' });
        setUri('');
        setUriError(null);
      },
      onError: (error) => {
        if (isReauthCancelled(error)) {
          return;
        }

        setUriError(error.message);
      },
    });
  };

  return (
    <div className="max-w-2xl">
      {client.redirectUris.length === 0 ? (
        <p className="text-sm text-muted">No redirect URIs registered yet.</p>
      ) : (
        <ul className="grid gap-2">
          {client.redirectUris.map((redirectUri) => (
            <li
              key={redirectUri.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line px-3 py-2 text-sm"
            >
              <span className="font-mono break-all">{redirectUri.uri}</span>
              <button
                type="button"
                onClick={() => setRemoving(redirectUri)}
                className="shrink-0 text-xs font-semibold text-danger hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormField label="Add redirect URI" error={uriError ?? undefined}>
        <div className="flex flex-wrap gap-2">
          <input
            value={uri}
            onChange={(event) => {
              setUri(event.target.value);
              setUriError(null);
            }}
            placeholder="https://app.company.com/auth/callback"
            aria-label="Redirect URI"
            className={`${inputClass} flex-1 font-mono`}
          />
          <button
            type="button"
            disabled={!uri.trim() || addRedirectUri.isPending}
            onClick={submit}
            className="rounded-card border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </FormField>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title="Remove redirect URI?"
        description={
          <p>
            Authorization requests using{' '}
            <span className="font-mono">{removing?.uri}</span> will be rejected.
          </p>
        }
        confirmLabel="Remove URI"
        tone="danger"
        pending={removeRedirectUri.isPending}
        onConfirm={() => {
          if (removing) {
            removeRedirectUri.mutate(removing.id, {
              onSuccess: () => {
                toast({ title: 'Redirect URI removed' });
                setRemoving(null);
              },
              onError: (error) => {
                setRemoving(null);

                if (!isReauthCancelled(error)) {
                  toast({
                    title: 'Could not remove URI',
                    description: error.message,
                    variant: 'danger',
                  });
                }
              },
            });
          }
        }}
      />
    </div>
  );
}

function CredentialsTab({ client }: { client: ClientDetail }) {
  const { toast } = useToast();
  const rotateSecret = useRotateClientSecret(client.id);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (client.type === 'public') {
    return (
      <p className="max-w-2xl text-sm text-muted">
        Public clients do not use a client secret. They rely on PKCE for proof
        of possession.
      </p>
    );
  }

  const rotate = () => {
    rotateSecret.mutate(undefined, {
      onSuccess: (result) => {
        setRevealed(result.clientSecret);
        setConfirming(false);
      },
      onError: (error) => {
        setConfirming(false);

        if (!isReauthCancelled(error)) {
          toast({
            title: 'Could not rotate secret',
            description: error.message,
            variant: 'danger',
          });
        }
      },
    });
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-muted">
        Secret status:{' '}
        <span className="font-semibold text-ink">
          {client.hasSecret ? 'A secret is set.' : 'No secret issued yet.'}
        </span>
      </p>

      {revealed ? (
        <div className="mt-4">
          <RevealSecret secret={revealed} onDismiss={() => setRevealed(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-card border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
        >
          {client.hasSecret ? 'Rotate secret' : 'Issue secret'}
        </button>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          client.hasSecret ? 'Rotate client secret?' : 'Issue client secret?'
        }
        description={
          <p>
            {client.hasSecret
              ? 'The current secret stops working immediately. Any integration using it must be updated with the new value.'
              : 'A new secret will be generated and shown once.'}
          </p>
        }
        confirmLabel={client.hasSecret ? 'Rotate secret' : 'Issue secret'}
        pending={rotateSecret.isPending}
        onConfirm={rotate}
      />
    </div>
  );
}

function StatusTab({ client }: { client: ClientDetail }) {
  const { toast } = useToast();
  const setStatus = useSetClientStatus(client.id);
  const [confirming, setConfirming] = useState(false);
  const disabling = client.status === 'active';
  const nextStatus = disabling ? 'disabled' : 'active';

  const apply = () => {
    setStatus.mutate(nextStatus, {
      onSuccess: () => {
        toast({ title: `Client ${nextStatus}` });
        setConfirming(false);
      },
      onError: (error) => {
        setConfirming(false);

        if (!isReauthCancelled(error)) {
          toast({
            title: 'Could not change status',
            description: error.message,
            variant: 'danger',
          });
        }
      },
    });
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-muted">
        Current status:{' '}
        <StatusBadge
          label={client.status}
          tone={clientStatusTone(client.status)}
        />
      </p>
      <button
        type="button"
        onClick={() => (disabling ? setConfirming(true) : apply())}
        disabled={setStatus.isPending}
        className={`mt-4 rounded-card border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
          disabling
            ? 'border-danger/40 text-danger hover:bg-danger/10'
            : 'border-accent/40 text-accent hover:bg-accent/10'
        }`}
      >
        {disabling ? 'Disable client' : 'Reactivate client'}
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Disable this client?"
        description={
          <p>
            OIDC flows for this client stop immediately. Existing tokens remain
            valid until they expire unless separately revoked.
          </p>
        }
        confirmLabel="Disable client"
        tone="danger"
        pending={setStatus.isPending}
        onConfirm={apply}
      />
    </div>
  );
}

function ActivityTab({ client }: { client: ClientDetail }) {
  return (
    <div className="max-w-2xl">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted uppercase">Created</dt>
          <dd className="mt-0.5">{formatDate(client.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Updated</dt>
          <dd className="mt-0.5">{formatDateTime(client.updatedAt)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm">
        <Link
          to={`/audit?clientId=${client.id}`}
          className="font-semibold text-accent hover:underline"
        >
          View audit events for this client
        </Link>
      </p>
    </div>
  );
}
