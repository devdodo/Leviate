import { profileNamesMatchPaystackAccount } from './legal-name.util';

describe('profileNamesMatchPaystackAccount', () => {
  it('matches when at least two profile name parts appear on the account', () => {
    expect(
      profileNamesMatchPaystackAccount('John', 'Doe', 'JOHN CHINEDU DOE'),
    ).toBe(true);
    expect(
      profileNamesMatchPaystackAccount('Mary', 'Jane', 'WATSON MARY JANE'),
    ).toBe(true);
  });

  it('rejects when fewer than two name parts match', () => {
    expect(
      profileNamesMatchPaystackAccount('John', 'Doe', 'JANE SMITH ADE'),
    ).toBe(false);
    expect(profileNamesMatchPaystackAccount('John', 'Doe', 'J DOE')).toBe(
      false,
    );
  });
});
