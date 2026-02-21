/**
 * Evaluates document risk level for disclaimers and optional acknowledgement.
 * Simple / Moderate / Advanced. Advanced requires explicit user acknowledgement before payment.
 */

const RISK_LEVELS = ['Simple', 'Moderate', 'Advanced'];

/**
 * @param {{ category: string, complexity: string }} classification
 * @returns {string} 'Simple' | 'Moderate' | 'Advanced'
 */
function evaluateRisk(classification) {
  const { category, complexity } = classification || {};
  if (category === 'litigation' || category === 'family' || complexity === 'advanced') {
    return 'Advanced';
  }
  if (category === 'corporate' || complexity === 'moderate') {
    return 'Moderate';
  }
  return 'Simple';
}

export { evaluateRisk, RISK_LEVELS };
