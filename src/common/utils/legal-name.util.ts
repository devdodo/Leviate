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
 * Returns true when at least two distinct name tokens from the profile
 * appear in the Paystack-resolved account name.
 */
export function profileNamesMatchPaystackAccount(
  firstName: string,
  lastName: string,
  paystackAccountName: string,
): boolean {
  const paystackTokens = new Set(tokenizePersonName(paystackAccountName));
  const profileTokens = [
    ...new Set([...tokenizePersonName(firstName), ...tokenizePersonName(lastName)]),
  ];

  if (profileTokens.length < 2) {
    return false;
  }

  const matchingCount = profileTokens.filter((token) =>
    paystackTokens.has(token),
  ).length;

  return matchingCount >= 2;
}

export function normalizeNameForComparison(name: string): string {
  return tokenizePersonName(name).join(' ');
}
