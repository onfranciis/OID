// Shared by configuration.ts and validation.ts so both read env values the
// same way: trimmed, with a whitespace-only value treated as absent rather
// than as a blank string that would otherwise slip past a `required` check.
export function readEnv(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
