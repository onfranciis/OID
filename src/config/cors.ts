// Parses the CORS_ALLOWED_ORIGINS env value: a comma-separated list of
// exact origins such as https://app.company.com. Empty entries are dropped,
// surrounding whitespace is trimmed, and anything that is not an http(s)
// origin is rejected so a typo cannot silently open an overly broad rule.
export function parseCorsAllowedOrigins(
  value: string | undefined,
): string[] {
  if (value === undefined) {
    return [];
  }

  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const origin of origins) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `CORS_ALLOWED_ORIGINS contains '${origin}', which is not a valid origin.`,
      );
    }

    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.pathname !== '/' ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0
    ) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS contains '${origin}', which is not a plain http(s) origin.`,
      );
    }
  }

  return [...new Set(origins)];
}
