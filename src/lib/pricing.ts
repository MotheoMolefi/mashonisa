/**
 * Mashonisa pricing: 35% total charges on principal (admin fee + interest).
 *
 * - ADMIN_FEE: fixed R100 on every loan (tiers only affect max principal).
 * - interestAmount: fills the rest so admin + interest = 35% × principal.
 * - vatAmount: always 0 here (business not VAT-registered); column kept for future.
 */
export const ADMIN_FEE = 100;
export const TOTAL_RETURN_RATE = 0.35;

/** Returns amounts stored on `loans` and shown on apply/admin UIs. */
export function getLoanPricing(principal: number) {
  const totalCharges = principal * TOTAL_RETURN_RATE;
  const interestAmount = totalCharges - ADMIN_FEE;
  const totalPayable = principal + totalCharges;
  return {
    totalPayable,
    adminFee: ADMIN_FEE,
    vatAmount: 0,
    interestAmount: Math.round(interestAmount * 100) / 100,
    totalCharges,
  };
}
