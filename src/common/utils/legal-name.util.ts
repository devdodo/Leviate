/** Normalize a person's name into comparable tokens (lowercase, no punctuation). */
export function tokenizePersonName(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Returns true when at least two distinct name tokens from the profile appear
 * in a name resolved from an external identity source (a bank account name, a
 * NIMC record). Order-insensitive, so "Ada Chidi Obi" matches "Obi Ada".
 */
export function profileNamesMatchIdentityName(
  firstName: string,
  lastName: string,
  identityName: string,
): boolean {
  const identityTokens = new Set(tokenizePersonName(identityName));
  const profileTokens = [
    ...new Set([...tokenizePersonName(firstName), ...tokenizePersonName(lastName)]),
  ];

  if (profileTokens.length < 2) {
    return false;
  }

  const matchingCount = profileTokens.filter((token) =>
    identityTokens.has(token),
  ).length;

  return matchingCount >= 2;
}

/**
 * Returns true when at least two distinct name tokens from the profile
 * appear in the Paystack-resolved account name.
 */
export function profileNamesMatchPaystackAccount(
  firstName: string,
  lastName: string,
  paystackAccountName: string,
): boolean {
  return profileNamesMatchIdentityName(firstName, lastName, paystackAccountName);
}

export function normalizeNameForComparison(name: string): string {
  return tokenizePersonName(name).join(' ');
}
