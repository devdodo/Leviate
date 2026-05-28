/**
 * Builds allowed CORS origins from CORS_ORIGINS (comma-separated),
 * FRONTEND_URL, and APP_URL (API host — required for Swagger on the API domain).
 */
export function resolveCorsOrigins(): string[] | true {
  const origins = new Set<string>();

  const list = process.env.CORS_ORIGINS;
  if (list) {
    for (const entry of list.split(',')) {
      const trimmed = entry.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  for (const key of ['FRONTEND_URL', 'APP_URL'] as const) {
    const value = process.env[key]?.trim();
    if (value) origins.add(value);
  }

  if (origins.size === 0) {
    return true;
  }

  return [...origins];
}
