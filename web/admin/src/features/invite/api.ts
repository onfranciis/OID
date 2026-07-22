// Mirrors features/auth/api.ts: dedicated fetch calls so an invalid/expired
// token surfaces as an inline error, not the shared client's login redirect.

export interface InviteSummary {
  email: string;
  displayName: string;
}

export class InviteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InviteError';
    this.status = status;
  }
}

function inviteUrl(token: string, suffix = ''): URL {
  return new URL(
    `/admin/api/invites/${encodeURIComponent(token)}${suffix}`,
    window.location.origin,
  );
}

export async function getInvite(token: string): Promise<InviteSummary> {
  const response = await fetch(inviteUrl(token), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  const data: unknown = response.headers
    .get('content-type')
    ?.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new InviteError(
      pickMessage(data) ?? 'This invite link is invalid or has expired.',
      response.status,
    );
  }

  return data as InviteSummary;
}

export async function acceptInvite(
  token: string,
  password: string,
): Promise<void> {
  const response = await fetch(inviteUrl(token, '/accept'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const data: unknown = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : null;

    throw new InviteError(
      pickMessage(data) ?? 'Could not set your password. Please try again.',
      response.status,
    );
  }
}

function pickMessage(data: unknown): string | null {
  if (data !== null && typeof data === 'object' && 'message' in data) {
    const message = data.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }

  return null;
}
