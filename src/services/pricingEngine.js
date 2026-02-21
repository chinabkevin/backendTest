/**
 * Dynamic pricing for document unlock. Business users pay higher base rate.
 * Returns final price in smallest currency unit (e.g. pence/cents).
 */

const CURRENCY = 'gbp';
const BASE_BY_CATEGORY = {
  contract: 499,   // £4.99 base
  litigation: 1299,
  corporate: 999,
  property: 799,
  family: 899,
  other: 599
};
const COMPLEXITY_MULTIPLIER = { simple: 1, moderate: 1.35, advanced: 1.7 };
const JURISDICTION_MODIFIER = 1.0; // UK default; could be 1.1 for other jurisdictions
const BUSINESS_MULTIPLIER = 1.4;
const REGENERATION_INCLUDED = 2;

/**
 * @param {Object} params
 * @param {string} params.category
 * @param {string} params.complexity
 * @param {string} params.userType - 'individual' | 'business'
 * @param {string} [params.jurisdiction]
 * @param {number} [params.regenerationCount]
 * @returns {{ finalPrice: number, currency: string, explanation: string, pricingBreakdown: object }}
 */
function calculatePrice({ category, complexity, userType, jurisdiction, regenerationCount = 0 }) {
  const base = BASE_BY_CATEGORY[category] ?? BASE_BY_CATEGORY.other;
  const compMult = COMPLEXITY_MULTIPLIER[complexity] ?? COMPLEXITY_MULTIPLIER.simple;
  const businessMult = userType === 'business' ? BUSINESS_MULTIPLIER : 1;
  const jurMult = jurisdiction ? JURISDICTION_MODIFIER : 1.0;

  const finalPrice = Math.round(base * compMult * businessMult * jurMult);
  const formatted = (finalPrice / 100).toFixed(2);

  const pricingBreakdown = {
    basePrice: base,
    complexityMultiplier: compMult,
    userTypeMultiplier: businessMult,
    jurisdictionMultiplier: jurMult,
    regenerationIncluded: REGENERATION_INCLUDED
  };

  const explanation = `£${formatted} — One-time download. Includes editable Word document + ${REGENERATION_INCLUDED} regenerations.`;

  return {
    finalPrice,
    currency: CURRENCY,
    explanation,
    pricingBreakdown,
    regenerationLimit: REGENERATION_INCLUDED
  };
}

export { calculatePrice, CURRENCY, REGENERATION_INCLUDED };
