Refined Document Generation & Paywall Flow
(Access-to-justice + sustainability aligned)
Core principle
Users see value before paying, but cannot extract value without paying.

Refined End-to-End Flow (Improved)
Step 1: User Prompt & AI Draft (Free)
User enters prompt in plain language
AI generates full draft in AI chat window
Draft includes:
Watermarked header/footer (UI-level, not document)
Inline “Draft – Not a Legal Document” label
User can:
Scroll
Ask AI to revise
Confirm accuracy
✅ Builds trust
✅ No cost barrier
❌ No file export yet

Step 2: User Requests Downloadable Format (Trigger Point)
User clicks:
“Generate Word version”
(later: PDF, DOCX, etc.)
⚠️ This is the pricing trigger — not generation

Step 3: Controlled Preview (Critical Refinement)
Instead of full Word rendering:
Preview rules
First 20–30% of document visible
Remaining content blurred / truncated
Disabled:
Copy
Select
Print
Visible metadata:
Document category
Complexity level
Jurisdiction (if applicable)
Risk label (Simple / Moderate / Advanced)
This prevents:
Screenshot harvesting
Free extraction
“I already saw it, why pay?” complaints

Step 4: Dynamic Pricing Gate
System calculates price using:
Document category
Complexity
User type (Individual / Business)
Jurisdiction sensitivity
Regeneration count
User sees:
Clear price
What they get
What they don’t get
Example copy:
“£7.99 — One-time download
Includes editable Word document + 2 regenerations”

Step 5: Payment & Access
After payment:
Full Word document unlocked
Download enabled
Regeneration limits activated
Document stored in user account
Optional:
Email delivery
Cloud storage

Step 6: Post-Download Safeguards
Timestamped document
Disclaimer embedded in footer
Version ID for audit trail
Jurisdiction label locked
This protects you, not just users.

Worst-Case Risks & Fixes (Brutal Check)
Risk
If ignored
Fix applied
Free value leakage
Users screenshot & leave
Partial preview + blur
“Bait & switch” claims
Refund disputes
Price shown before payment
Regulatory scrutiny
“Selling legal advice”
Clear draft & disclaimer
Over-reliance on AI
User harm
Risk labels + escalation
Business misuse
Commercial exposure
Higher business pricing


Formal Use Case (Implementation-Ready)

Use Case: Paid Download of AI-Generated Legal Document
Use Case ID
UC-DOC-PAY-001

Primary Actor
End User (Individual or Business)

Supporting Systems
AI Document Generator
Pricing Engine
Payment Gateway
Document Renderer (Word)
User Account Service

Preconditions
User has an active session
AI draft document exists
Document category & complexity determined

Trigger
User clicks “Generate Word Version”

Main Flow (Success Path)
User generates AI document in chat window
User reviews and confirms content
User selects “Generate Word version”
System:
Classifies document
Calculates price
Renders preview version
System displays:
Partial document preview
Price breakdown
Download benefits
User clicks “Unlock Full Download”
User completes payment
System:
Unlocks full Word document
Enables download
Stores document in user account
User downloads document successfully

Alternative Flows
A1: User abandons at pricing stage
No charge
Document remains locked
Draft remains accessible in AI window
A2: Payment failure
Download remains locked
User prompted to retry or change payment method
A3: Advanced / High-Risk Document
Warning banner displayed
Lawyer escalation recommendation shown
User must explicitly acknowledge risk

Postconditions
Paid document accessible
Audit trail logged
Regeneration limits enforced

Business Rules
No download without payment
Preview limited to max 30%
Advanced documents require risk acknowledgement
Business users charged higher rates

Why This Model Works (Strategically)
For users
No upfront payment
Clear value before buying
Simple decision
For you
Strong conversion
Minimal abuse
Regulator-defensible
Scales cleanly
For access to justice
Free drafting
Paid extraction only
Fair pricing, not gatekeeping

Final Verdict (Straight)
Your model is sound.
With the refinements above, it becomes:
Commercially robust
Ethically defensible
Technically enforceable
Legally safer
How It Should Work (Practically)
AI Chat Window (Pre-Payment)
Allowed
Scroll
Regenerate
Ask AI to refine
Confirm content quality
Blocked
Text selection
Copy
Right-click
Keyboard shortcuts (Ctrl+C / Cmd+C)
“Select all”
Drag selection
UI Indicators
Subtle lock icon
Tooltip:
“Copying and downloading are available after unlock.”

---

## How `document_fee` is set (implementation)

Per **Step 4: Dynamic Pricing Gate**, the system calculates price using document category, complexity, user type, jurisdiction, and regeneration count. The stored `document_fee` is set in two places:

### 1. At preview (pricing trigger) — primary source

When the user clicks **“Generate Word Version”** (Step 2 trigger), the preview flow runs:

1. **Classify** the document (category + complexity) — `documentClassifier.js`
2. **Calculate price** — `pricingEngine.js` using:
   - **Document category** (contract, litigation, corporate, property, family, other) → base price in pence
   - **Complexity** (simple / moderate / advanced) → multiplier
   - **User type** (individual / business) → business users pay higher (×1.4)
   - **Jurisdiction** (optional modifier)
   - **Regeneration count** (included in explanation; 2 regenerations included)
3. **Persist the price** — `documentPreview()` in `documentController.js` runs:
   - `UPDATE documents SET document_fee = pricing.finalPrice, category, complexity, risk_level, ... WHERE id = ?`
4. Return preview content (first 30%), price, and copy e.g. *“£7.99 — One-time download. Includes editable Word document + 2 regenerations.”*

So **after the user has seen the preview**, `document_fee` is the dynamic price and is used for “Unlock Full Download” / checkout.

### 2. At document creation — fallback default

When a new document is created (after AI generation), it is inserted with a **default** fee in pence (e.g. 999 = £9.99) so that:

- Checkout never receives an invalid amount if someone pays without going through preview.
- Old records or edge cases always have a valid fee.

**Code references**

- **Preview (set fee):** `backend/src/controllers/documentController.js` → `documentPreview()` → `UPDATE ... document_fee = pricing.finalPrice`
- **Pricing logic:** `backend/src/services/pricingEngine.js` → `calculatePrice({ category, complexity, userType, jurisdiction, regenerationCount })`
- **Classification:** `backend/src/services/documentClassifier.js` → `classifyDocument(content, templateId)`
- **Creation default:** `documentController.js` → `DEFAULT_DOCUMENT_FEE_PENCE` used in `INSERT INTO documents`
- **Frontend fallback:** If `document_fee` is 0 or missing, the UI sends 999 pence so the payment session always gets a valid amount.

