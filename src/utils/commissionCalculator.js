/**
 * Platform commission: 15% of every freelancer charge.
 * Formula: Platform Fee = Amount × 15%, Freelancer Earnings = Amount − Platform Fee
 * @param {number} amountInCents - Total amount paid by client (in cents)
 * @returns {{ amount: number, platformFee: number, freelancerEarnings: number }}
 */
export function calculateFreelancerPayout(amountInCents) {
  const amount = Math.round(Number(amountInCents)) || 0;
  const platformFee = Math.round(amount * 0.15);
  const freelancerEarnings = amount - platformFee;
  return {
    amount,
    platformFee,
    freelancerEarnings,
  };
}

export const PLATFORM_COMMISSION_RATE = 0.15;
