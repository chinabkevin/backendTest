/**
 * Classifies documents by category and complexity for pricing and risk.
 * Does NOT change generation logic; used only for paywall/pricing.
 */

const CATEGORY_KEYWORDS = {
  contract: ['contract', 'agreement', 'terms', 'nda', 'non-disclosure', 'employment', 'lease', 'rental', 'service agreement'],
  litigation: ['claim', 'complaint', 'motion', 'brief', 'discovery', 'litigation', 'court'],
  corporate: ['incorporation', 'bylaws', 'shareholder', 'board', 'resolution', 'merger', 'acquisition'],
  property: ['deed', 'mortgage', 'title', 'conveyance', 'real estate', 'property'],
  family: ['divorce', 'custody', 'prenup', 'adoption', 'guardianship', 'family'],
  other: []
};

const COMPLEXITY_LEVELS = ['simple', 'moderate', 'advanced'];

/**
 * @param {string} content - Full or partial document text
 * @param {string} templateId - Optional template id from generation
 * @returns {{ category: string, complexity: string }}
 */
function classifyDocument(content, templateId = '') {
  const text = ((content || '') + ' ' + (templateId || '')).toLowerCase();
  let category = 'other';
  let keywordCount = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'other') continue;
    const matches = keywords.filter(kw => text.includes(kw.toLowerCase()));
    if (matches.length > keywordCount) {
      keywordCount = matches.length;
      category = cat;
    }
  }

  const wordCount = (content || '').split(/\s+/).filter(Boolean).length;
  let complexity = 'simple';
  if (wordCount > 1500 || category === 'litigation' || category === 'corporate') complexity = 'advanced';
  else if (wordCount > 600 || keywordCount >= 3) complexity = 'moderate';

  return { category, complexity };
}

export { classifyDocument, COMPLEXITY_LEVELS };
