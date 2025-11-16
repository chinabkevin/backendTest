Barrister Signup Process
1. Eligibility Check
2. Document Upload
3. Professional Information
4. Subscription Selection
5. Legal Declaraction
6. Compliance Verification
Upon successfull we need to direct a barrister to Barrister dashboard

Stage 1: Eligibility Check, the first stage in the Barrister Sign-Up process.
Below is a detailed user flow breakdown that a developer or UX designer can directly
implement for the Eligibility Check stage.
User Flow — Stage 1: Eligibility Check
Objective
To confirm that only barristers qualified under the BSB Public Access Rules can proceed to
onboarding.
1. Entry Point
Trigger:
User clicks “Sign up as a Barrister” on the Advoqat homepage.
System action:
• Display a welcome message:
“Join Advoqat as a Public Access Barrister. Please confirm your eligibility before
continuing.”
Options:
• Continue → Proceeds to Eligibility Form
• Back → Returns to main landing page
2. Eligibility Form Display
Screen: “Eligibility Criteria”
Form elements:
Field Type Required Validation
Do you hold a current Practising
Certificate issued by the BSB? Checkbox ✅ Must be checked
Are you registered as a Public Access
Barrister? Checkbox ✅ Must be checked
Have you completed BSB-approved
Public Access training? Checkbox ✅ Must be checked
Do you hold active BMIF
professional indemnity insurance? Checkbox ✅ Must be checked
Are you currently in good standing
with the BSB (no suspension)? Checkbox ✅ Must be checked
Field Type Required Validation
Are you under 3 years’ call? If yes, do
If “Yes,” text input
Yes/No +
you have a qualified person for
Conditional Field Optional
appears for supervisor
supervision?
details
3. System Validation Logic
When user clicks “Continue”, system runs:
• If any mandatory checkbox is unchecked →
⚠ Show inline error: “You must meet all eligibility requirements to proceed.”
• If all boxes checked →
✅ Proceed to Document Upload Stage
4. System Actions
If eligibility passes:
• Store answers temporarily (Firebase or backend DB).
• Mark profile status as eligibility_passed: true.
• Trigger event: onboarding_stage = "documents_upload".
If eligibility fails:
• Display message:
“You may not meet the current eligibility requirements for Public Access barristers.
Please review the Bar Standards Board guidance.”
Offer link:
→ Public Access Guidance for Barristers – BSB
5. Exit Points
Scenario System Output
✅ All conditions met Redirect to Stage 2: Document Upload
❌ One or more criteria not met Display warning; user cannot continue
⏪ User exits form Save progress as draft (optional)
6. System Notes for Developers
• Store eligibility responses in a separate table (e.g., barrister_eligibility).
• Use conditional rendering: if “Under 3 years’ call” is selected, show additional
“Qualified Person” field.
• Add backend validation to prevent bypass (even if user edits frontend).
• Capture timestamp of form submission for compliance logs.
• Send confirmation email (optional):
“Thank you for confirming your eligibility to join Advoqat as a Public Access
Barrister. Next step: upload your verification documents.”
🧭 Flow Summary Diagram (Text-based)
Start → Click “Sign up as Barrister”
↓
Display Eligibility Form
↓
User selects checkboxes & provides info
↓
Validation Check
↳ If incomplete → Error message
↳ If complete → Save data → Proceed to Document Upload
↓
End of Stage 1
User Flow — Stage 2: Document Upload
Objective
To securely collect and verify all mandatory legal documents required by the Bar Standards
Board (BSB) before the barrister can proceed.
1. Entry Point
Trigger:
User successfully completes the Eligibility Check.
System Action:
• Redirect to “Upload Required Documents” page.
• Display progress bar → Step 2 of 6: Document Upload.
• Show a note:
“Please upload the required documents to verify your practising status. Only PDF or
image files are accepted.”
2. Document Upload Screen
Required Documents
Document Type Description File Type Required Validation
Practising
Certificate
Current certificate issued
by BSB PDF/JPG/PNG ✅ Must not be blank
Document Type Description File Type Required Validation
Proof of Public Access
Public Access
Accreditation
training or BSB
PDF/JPG/PNG ✅ Must not be blank
registration screenshot
BMIF Insurance
Proof
Current insurance
confirmation PDF/JPG/PNG ✅ Must not be blank
Name, email, and
Required if
Qualified Person
(if <3 years call)
supporting document
Text + File Conditional
“Under 3 years
(optional)
call” = Yes
3. UI Components
Main elements:
• Drag-and-drop upload zone for each document
• Progress indicator (percentage or loading bar)
• Status tags: Pending, Uploaded, Verified
• File preview + remove option
• Tooltip: “Ensure the document clearly shows your name, expiry date, and BSB
registration number.”
Action buttons:
• [Save Draft] → Temporarily stores uploads
• [Continue to Next Step] → Validates and submits all uploads
4. Validation & Error Handling
Frontend Validation
• File type must be .pdf, .jpg, .png
• File size limit: 5 MB
• Each required field must be completed
Backend Validation
• Check file metadata (size, format)
• Store document metadata (file name, hash, upload time, uploader ID) in
barrister_documents table
• Create secure URL reference in AWS S3 / Firebase Storage
• Auto-tag status = “Pending Verification”
Error Messages
Scenario Error Message
Missing required file “Please upload all mandatory documents before continuing.”
Invalid format “Unsupported file type. Please upload PDF, JPG, or PNG.”
File too large “File exceeds 5 MB limit.”
5. System Actions After Upload
Once the barrister uploads all required documents and clicks Continue:
1. Files are stored securely.
2. The system automatically sends an internal alert to the admin dashboard:
o status = PENDING_VERIFICATION
o stage = document_upload_completed
3. An email notification is sent to the user:
“Your documents have been received and are now under review. You’ll be notified
once they’re verified.”
6. Exit Points
Scenario System Outcome
✅ All documents valid Proceed to Stage 3: Professional Information
⚠ Missing/Invalid file Show inline error; block continuation
⏸ User saves draft Return later with saved progress
❌ User cancels onboarding Store partial data; allow resume within 7 days
7. System Notes for Developers
• Create a new table: barrister_documents
• barrister_documents (
• id SERIAL PRIMARY KEY,
• user_id UUID,
• document_type VARCHAR(50),
• file_url TEXT,
• status ENUM('pending','verified','rejected'),
• uploaded_at TIMESTAMP,
• verified_at TIMESTAMP,
• verified_by VARCHAR(100)
• )
• Auto-sync with users table via user_id.
• Allow admin users to download/view files directly from dashboard.
• Implement audit logging for document updates.
• Add file integrity check (hash verification) to prevent tampering.
Flow Summary Diagram (Text-Based)
Start → Eligibility Passed
↓
Display "Document Upload" Page
↓
User uploads required files
↓
Frontend validation (file type, size, required)
↓
If valid → Store in secure storage + mark "Pending Verification"
↓
Send confirmation email
↓
Proceed to Stage 3: Professional Information
User Flow — Stage 3: Professional
Information (Profile Setup)
Objective
Collect all profile, transparency, and regulatory display details required for a barrister’s
public profile in line with BSB transparency (rC163–rC169) and Public Access rules.
1) Entry Point
Trigger: User completes Stage 2 with all required documents uploaded.
System Action:
• Route to /onboarding/profile
• Show progress: Step 3 of 6: Professional Information
2) Screen: Profile Setup Form
2.1 Core Identity
Fields (grouped card):
• Full Name (text, required)
• Professional/Trading Name (text, optional)
• Year of Call (numeric, required; 4-digit)
• BSB Registration Number (text, required)
• Chambers / Practice Address (multi-line, optional)
• Public Email for Clients (email, required)
• Public Phone (optional) (tel, optional)
• Website / Chambers profile URL (url, optional)
Validation:
• Email format; Year of Call between 19xx–current year; URL pattern.
2.2 Authorisation & Status
• Public Access Authorised (checkbox, required → must be true to proceed)
• Areas of Authorisation / Practice Rights (multi-select; e.g., “Public Access”,
“Conduct of Litigation (if authorised)”, “Direct Access – Immigration” etc.)
• Regulatory Status (auto-generated, read-only):
“[Name] is a self-employed barrister regulated by the Bar Standards Board and
authorised for Public Access work.”
2.3 Expertise & Services
• Areas of Practice (multi-select with search; e.g., Family, Immigration, Employment,
Commercial, Crime) – required (≥1)
• Services Offered (checkbox list + free text):
o Advice / Written Opinion
o Document Drafting (pleadings, grounds, contracts)
o Conference / Consultation
o Hearing / Representation
o Other (text)
• Matter Suitability Statement (for Public Access) (short textarea, required)
“Typical matters I accept under Public Access and when solicitor involvement may be
required.”
2.4 Pricing Transparency (BSB rC163–rC169)
(Show helper text explaining BSB transparency expectations.)
• Pricing Model (radio, required): Hourly / Fixed Fee / Package / Mixed
• Indicative Hourly Rate (currency, conditional if Hourly or Mixed)
• Fixed Fee Examples (repeatable rows: Service, Typical scope, Indicative fee range,
optional)
• Key Stages & Timescales (textarea, required)
• Complaints/Redress Info (short) (textarea, optional, with helper link)
• VAT Status (radio: VAT-registered / Not VAT-registered, required)
UI niceties:
• Add “+ Add fixed-fee example” button
• Inline hints (e.g., “State assumptions/exclusions to avoid scope creep.”)
2.5 Public Access & Client Guidance Links
• Mandatory Link (auto): “Public Access Guidance for Lay Clients” (BSB) – read-
only, shown on public profile.
• Upload Profile Photo (image, optional; JPG/PNG ≤ 2MB)
• Short Bio (max 600 chars) (textarea, required)
2.6 Availability & Logistics (Optional but useful)
• Typical Response Time (dropdown: <24h / 1–2 days / 3–5 days)
• Consultation Channels (checkboxes: Phone, Video, In-person)
• Coverage (Courts / Circuits / Remote) (multi-select)
• Languages (multi-select)
3) Inline Validations & Errors
• Required fields must be completed before Continue.
• Currency fields numeric; hourly rate ≥ 0.
• Text limits (bio 600 chars).
• Multi-select minimums (≥1 area of practice).
Error messages (examples):
• “Please select at least one Area of Practice.”
• “Pricing model is required.”
• “Key stages & timescales are required for transparency.”
4) Actions
Buttons:
• Save Draft (persists partial profile; toast: “Saved”)
• Preview Public Profile (opens modal/route showing how clients will see it)
• Continue (runs validation → success routes to Stage 4)
System on Continue (success):
• Persist profile to DB; set profile_complete=true
• Emit event onboarding_stage = "subscription"
• Audit log entry (user_id, changed fields, timestamp)
5) Exit Points
Scenario Outcome
Continue (valid) Route to Stage 4: Subscription Selection
Save Draft Remain; state saved; can resume later
Cancel Warn about unsaved changes; return to dashboard
6) Developer Notes (Data Model & API)
6.1 Suggested Tables
barrister_profiles
id UUID PK,
user_id UUID UNIQUE NOT NULL,
full_name TEXT NOT NULL,
trading_name TEXT,
year_of_call INT NOT NULL,
bsb_number TEXT NOT NULL,
practice_address TEXT,
public_email TEXT NOT NULL,
public_phone TEXT,
website_url TEXT,
public_access_authorised BOOLEAN NOT NULL DEFAULT TRUE,
authorisations TEXT[], -- e.g., ARRAY
areas_of_practice TEXT[] NOT NULL,
services_offered TEXT[],
suitability_statement TEXT NOT NULL,
pricing_model TEXT NOT NULL,
-- 'hourly' | 'fixed' | 'package' | 'mixed'
hourly_rate NUMERIC(10,2),
key_stages_timescales TEXT NOT NULL,
complaints_info TEXT,
vat_status TEXT NOT NULL,
-- 'vat' | 'novat'
profile_photo_url TEXT,
bio TEXT,
response_time TEXT,
consultation_channels TEXT[],
coverage_regions TEXT[],
languages TEXT[],
bsb_public_access_link TEXT DEFAULT
'https://www.barstandardsboard.org.uk/for-the-public/finding-and-using-a-
barrister/public-access-guidance-for-lay-clients.html',
profile_complete BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP,
updated_at TIMESTAMP
);
barrister_fixed_fee_examples
id UUID PK,
profile_id UUID REFERENCES barrister_profiles(id) ON DELETE CASCADE,
service_name TEXT,
scope_summary TEXT,
fee_min NUMERIC(10,2),
fee_max NUMERIC(10,2)
);
6.2 API Endpoints (REST)
• GET /api/onboarding/profile → fetch draft/profile
• POST /api/onboarding/profile → create/update profile
• POST /api/onboarding/profile/preview → returns preview payload
• Auth: JWT; Role: Barrister
6.3 Security & Audit
• Server-side enforce: public_access_authorised = true
• Record all writes in audit_logs with field diffs.
• Sanitize HTML in free-text (bio, statements) to prevent XSS.
• Image processing: strip EXIF, resize to max dimensions (e.g., 600x600).
6.4 Accessibility (A11y)
• All inputs labeled; error messages linked via aria-describedby.
• Keyboard navigable; minimum contrast AA.
• Character counters for bio and long text.
7) Success Criteria (QA)
• Cannot proceed without: name, year of call, BSB number, areas of practice, pricing
model, key stages & timescales, bio.
• Preview matches stored data and regulatory tags appear.
• BSB guidance link visible on preview.
• Data persists and reloads correctly after refresh.
• Server rejects invalid payloads even if client bypassed checks.
8) Text-Based Flow Diagram
Stage 2 Complete
↓
Open /onboarding/profile (Step 3/6)
↓
Fill Identity → Authorisation → Expertise/Services → Pricing Transparency →
Bio & Links
↓ (Validate each section)
Preview (optional) ──► Close Preview
↓
Save Draft (optional)
↓
Continue (server validation + persist)
↓
Set profile_complete = true; onboarding_stage = "subscription"
↓
Proceed to Stage 4: Subscription Selection
User Flow — Stage 4: Subscription &
Payment
Objective
Enable barristers to choose a fixed, non-contingent platform plan and activate recurring
billing (no referral/commission), with clear invoices and VAT handling.
1) Entry Point
Trigger: User completes Stage 3 with profile_complete = true.
System Action:
• Route to /onboarding/subscription
• Show progress: Step 4 of 6: Subscription & Payment
• Display plan cards and a short compliance note:
“Advoqat charges fixed platform fees only. We do not take commissions or referral
fees.”
2) Screen: Plan Selection
2.1 Plans (example — configurable via admin)
• Basic — £0 (trial/limited visibility)
• Professional — £49.99/month (default, full visibility, messaging, bookings)
• Premium — £79.99/month (boosted visibility, analytics, compliance reminders)
Each card shows:
• Features list
• Billing period (monthly; toggle for annual with discount optional)
• VAT note: “Prices exclude VAT (if applicable).”
Controls
• Radio select one plan
• Toggle: “Annual billing (save X%)” (optional)
• Button: Continue to Payment
Validation:
• A plan must be selected.
3) Screen: Billing & Payment Details
3.1 Billing Info
Fields:
• Billing Contact Name (required)
• Billing Email (required)
• Business/Chambers Name (optional)
• Billing Address (required for tax)
• Country (required; drives tax rules)
• VAT Number (optional; validate format for country)
3.2 Payment Method
• Card element (Stripe Payment Element or Card Element)
• Save method for future payments (checkbox, default true)
3.3 Legal Copy (inline)
• “By subscribing you agree to recurring charges until cancelled.”
• Link to Platform Fee Terms (no referral/commission; cancellation policy; refunds).
• Link to Privacy Policy.
Buttons
• Start Subscription (disabled until valid)
• Back (to plan selection)
• Save Draft (optional)
4) Payment Flow (Stripe recommended)
4.1 Client→Server
• Client posts plan_id, billing data.
• Server creates/attaches Stripe Customer to user_id.
• Server creates Subscription with price ID, payment_behavior=default_incomplete,
collection_method=charge_automatically, trial_period_days (if offering free trial),
and expands latest_invoice.payment_intent.
4.2 3D Secure / SCA
• If payment_intent.status = requires_action, present Stripe’s SCA modal.
• On success, confirm and proceed.
• On failure, show error and keep user on page with retry.
4.3 Webhooks
Handle:
• invoice.payment_succeeded → mark billing_status=active,
subscription_status=active, set onboarding_stage = "declarations".
• invoice.payment_failed → mark billing_status=past_due; show banner +
send email.
• customer.subscription.updated (plan change, cancellation, trial end).
• customer.subscription.deleted (cancellation).
4.4 Taxes
• Use Stripe Tax or your tax engine.
• Compute VAT based on billing country + VAT number (reverse charge where
applicable).
• Display tax line on the checkout summary and invoices.
4.5 Invoicing
• Enable hosted invoices & receipt emails.
• Store invoice ID + URL for the user to download in the billing tab.
5) Plan Changes (Upgrades/Downgrades)
• Upgrade mid-cycle: Prorate immediately (Stripe default).
• Downgrade: Schedule at period end (recommended to avoid refunds).
• Annual↔Monthly: Apply proration rules; clearly display next charge date.
UI:
• “Change plan” link (post-onboarding) in Account → Billing.
• Confirm dialogue summarising proration/next invoice.
6) Free Trial (Optional)
• Configure trial_period_days (e.g., 14).
• Require card upfront (recommended to reduce churn) or allow trial without card.
• Email reminders: T-3 days & T-1 day before trial ends.
• At trial end, continue auto-billing if payment method present; otherwise dunning.
7) Dunning & Retries
• Retry schedule (e.g., Day 3, 7, 14).
• Show Past Due banner in app with “Update Payment Method”.
• Email sequence with secure link to Stripe customer portal or in-app update form.
• Cancel automatically after final failed attempt (configurable), or restrict access.
8) Compliance Copy & Separation of Fees
• Order summary must show two distinct concepts (wording matters):
o “Advoqat Platform Subscription” (the only charge by Advoqat)
o Note: “Barrister’s professional fees are billed separately and are not collected
by Advoqat.”
• Avoid terms like commission, referral fee, success fee anywhere.
9) Success & Next Step
On successful subscription creation (via webhook or immediate confirmation if no SCA):
• Toast: “Subscription activated.”
• Set subscription_status=active in DB.
• Route to Stage 5: Legal Declarations & Terms.
• Send Welcome to [Plan] email with invoice link.
10) Failure Handling
Scenarios & UX:
• Card declined / SCA failed: Inline error; keep form state; allow retry.
• Webhook timeout: Poll subscription status; display neutral “Processing…” banner;
do not double-charge.
• Validation errors (VAT, address): Inline hints and field-level messages.
11) Developer Notes (Data Model & API)
11.1 Tables
subscriptions
id UUID PK,
user_id UUID UNIQUE NOT NULL,
plan_code TEXT NOT NULL,
provider_customer_id TEXT NOT NULL,
provider_subscription_id TEXT, status TEXT NOT NULL,
incomplete|active|trialing|past_due|canceled
billing_interval TEXT NOT NULL,
trial_end TIMESTAMP,
current_period_end TIMESTAMP,
created_at TIMESTAMP,
updated_at TIMESTAMP
);
-- basic|pro|premium
-- Stripe customer id
-- Stripe sub id
--
-- monthly|annual
billing_methods
id UUID PK,
user_id UUID NOT NULL,
provider_payment_method_id TEXT NOT NULL,
brand TEXT,
last4 TEXT,
exp_month INT,
exp_year INT,
is_default BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP
);
invoices
id UUID PK,
user_id UUID NOT NULL,
provider_invoice_id TEXT NOT NULL,
amount_ex_tax NUMERIC(10,2),
tax_amount NUMERIC(10,2),
currency TEXT,
hosted_invoice_url TEXT,
pdf_url TEXT,
status TEXT, -- paid|open|void|uncollectible
issued_at TIMESTAMP
);
users (or barrister_profiles) additions:
• onboarding_stage (enum)
• billing_status (enum)
• subscription_status (enum)
11.2 Endpoints
• POST /api/billing/start — create customer + subscription (secure server-side)
• POST /api/billing/pm/update — attach/replace payment method
• POST /api/billing/plan/change — upgrade/downgrade
• POST /api/billing/cancel — cancel at period end
• POST /api/webhooks/stripe — webhook handler (idempotent)
11.3 Security
• Server-side validate plan_code against allowlist.
• Idempotency keys on mutation calls.
• Role checks (only owner can manage their billing).
• Never trust client for amounts; prices loaded from server.
12) Accessibility & UX
• Keyboard focus states for form fields and card element.
• Clear, readable order summary with tax line.
• Announce SCA modal via ARIA live region.
• Receipt and invoice links accessible and persistent.
13) Acceptance Criteria (QA)
• User cannot continue without selecting a plan and providing valid billing details
(unless free Basic plan selected).
• Successful payments set subscription_status=active and move user to Stage 5.
• VAT calculated/displayed correctly per country + VAT number.
• Webhooks robust to retries; state in DB matches Stripe.
• Dunning emails and banners fire on failures; access restricted if past_due.
• No copy anywhere suggests referral/commission/success fees.
14) Text-Based Flow Diagram
Stage 3 Complete
↓
/onboarding/subscription (plan cards)
↓ (select plan)
Continue to Payment
↓
Billing details + Payment method → Start Subscription
↓
SCA (if required) → success
↓
Webhook confirms → status=active
↓
Proceed to Stage 5: Legal Declarations & Terms
User Flow — Stage 5: Legal Declarations &
Terms
Objective
Capture all mandatory legal acknowledgements (BSB/Public Access compliance, insurance,
independence, no-referral-fee model, data protection), a binding acceptance of Advoqat
terms, and an e-signature with full audit trail.
1) Entry Point
Trigger: Subscription is active (or Basic plan selected if free).
Route: /onboarding/declarations
UI: Progress Step 5 of 6: Legal Declarations & Terms + short explainer
“Please review and accept these declarations to complete onboarding.”
2) Screen Structure (Accordion or Sections)
1. Regulatory Declarations (BSB/Public Access)
2. 3. Platform Terms of Use (Barrister)
Privacy & Data Processing (GDPR)
4. Conflicts, Complaints & Withdrawal
5. No Referral/Commission Acknowledgement
6. Signature & Final Confirmation
Each section must be individually confirmed before the Finish & Sign button is enabled.
3) Section Details & Required Inputs
3.1 Regulatory Declarations (BSB/Public Access)
• Checkboxes (required):
o “I hold a current BSB practising certificate.”
o “I am registered and authorised for Public Access work and will comply with
the Public Access Rules.”
o “I maintain indemnity insurance with Bar Mutual Indemnity Fund (BMIF)
and will keep it current.”
o “I will maintain proper records, confidentiality, and competency as required
by the BSB Handbook.”
o “If at any point the matter is unsuitable for Public Access, I will inform the
client and recommend instructing a solicitor (rC122–rC123).”
• Inline link(s):
o BSB Handbook, Public Access Guidance for Lay Clients (auto-shown
elsewhere on profile too)
Validation: All must be checked.
3.2 Platform Terms of Use (Barrister)
• Long-scroll text area or embedded viewer with version label (e.g., ToU v1.4
(2025-10-01)).
• Requirement: Scroll-to-end detection before checkbox activates.
• Checkbox (required): “I agree to the Advoqat Barrister Terms of Use.”
Notes:
• Terms must include independence, role of Advoqat (intermediary, not law firm),
acceptable use, content standards, prohibited activities, termination, governing
law/jurisdiction.
3.3 Privacy & Data Processing (GDPR)
• Long-scroll: Privacy Policy + DPA summary.
• Checkbox (required): “I acknowledge Advoqat’s Privacy Policy and Data
Processing terms.”
• Checkbox (optional): “I consent to receive product and compliance updates by
email.” (marketing consent; store as separate boolean with timestamp.)
3.4 Conflicts, Complaints & Withdrawal
• Checkboxes (required):
o “I will perform conflict checks and decline/withdraw where conflicts exist.”
o “I will provide or adhere to a client care/complaints process and inform clients
of relevant routes (BSB/LeO where applicable).”
o “I acknowledge I must not hold client money unless permitted and will use
approved routes for payments.”
• Short textarea (optional): Barrister’s complaints contact or link.
3.5 No Referral/Commission Acknowledgement
• Copy block: Clarifies no referral fees, no success-based commissions; only fixed
platform/admin fees.
• Checkbox (required):
“I acknowledge that Advoqat charges fixed platform/admin fees only and that I must
not pay or receive referral fees in connection with instructions obtained via Advoqat.”
3.6 Signature & Final Confirmation
• Fields (required):
o Typed name (matches profile full name by default; editable)
o Signature (draw or type-to-sign)
o Place of signing (city/country; optional)
• Auto-captured: Timezone, timestamp (UTC and local), public IP, device/user agent.
• Checkbox (required): “I confirm the above statements are true and I understand that
providing false information may lead to suspension or removal.”
Primary CTA: Finish & Sign
4) Validation & Errors
• All required checkboxes checked, ToU/Privacy scrolled.
• Signature captured and not blank.
• Display inline errors per section, plus global banner if submission fails.
Common messages:
• “Please read and accept the Terms of Use before continuing.”
• “Signature is required.”
• “All regulatory declarations must be confirmed.”
5) System Actions on Success
1. 2. Persist all declarations + signature artifacts.
Generate a signed PDF receipt (Terms acceptance + declarations + signature + audit
trail).
3. Email the user:
o Subject: “Your Advoqat Declarations & Terms — Confirmation”
o Attach PDF / include secure link to download
4. Update user state:
o declarations_complete = true
o onboarding_stage = "verification" (Stage 6)
5. Log audit entry (immutable): consent items, versions, timestamps, IP, UA.
6) Exit Points
Scenario Outcome
Finish & Sign Move to Stage 6: Admin Verification
Save Draft Persist partial (unchecked boxes/signature not saved as complete)
Cancel / Back Prompt to confirm; unsaved changes warning
7) Developer Notes (Data, API, PDF)
7.1 Data Model
legal_consents
id UUID PK,
user_id UUID NOT NULL,
tou_version TEXT NOT NULL,
privacy_version TEXT NOT NULL,
policy_locale TEXT DEFAULT 'en-GB',
consent_public_access BOOLEAN NOT NULL,
consent_practising_cert BOOLEAN NOT NULL,
consent_bmif BOOLEAN NOT NULL,
consent_records_confidentiality BOOLEAN NOT NULL,
consent_rc122_rc123 BOOLEAN NOT NULL,
consent_tou BOOLEAN NOT NULL,
consent_privacy BOOLEAN NOT NULL,
consent_marketing BOOLEAN DEFAULT FALSE,
consent_conflicts BOOLEAN NOT NULL,
consent_complaints BOOLEAN NOT NULL,
consent_no_client_money BOOLEAN NOT NULL,
consent_no_referral_fee BOOLEAN NOT NULL,
signed_name TEXT NOT NULL,
signature_blob_url TEXT NOT NULL,
signed_at_utc TIMESTAMP NOT NULL,
signed_at_local TIMESTAMP NOT NULL,
signer_ip INET,
signer_user_agent TEXT,
signer_location TEXT,
pdf_receipt_url TEXT,
created_at TIMESTAMP,
updated_at TIMESTAMP
);
-- image or vector path
audit_logs (existing or new) should record field diffs and key consent hashes.
7.2 Endpoints
• GET /api/onboarding/declarations → fetch current versions + any draft consent
state
• POST /api/onboarding/declarations → submit booleans + signature payload
• POST /api/onboarding/declarations/receipt → server generates & stores
signed PDF, returns URL
• Security:
o Validate that subscription_status or plan permits progress.
o Enforce latest ToU/Privacy versions server-side (reject stale versions).
o Idempotency key on submit to prevent double writes.
7.3 PDF Receipt (Server-Side)
• Contents:
o User identity (name, email, BSB number)
o Checklist of consents with TRUE/FALSE
o ToU and Privacy version + hash
o Timestamp (UTC & local), IP, UA, location
o Signature image & typed name
• Store in secure bucket, link in email, visible under Account → Legal & Consents.
8) Security & Compliance
• Immutable log (WORM or append-only strategy) for consent events.
• Version pinning: Declarations tied to ToU/Privacy versions accepted.
• Re-consent workflow: If ToU/Privacy updates, prompt at next login with diff
summary; restrict access until accepted.
• PII minimisation: Only necessary data in consent records; encrypt at rest.
• Accessibility: Long texts navigable by keyboard; ARIA for error summaries;
readable font/contrast.
9) QA / Acceptance Criteria
• Users cannot proceed without completing all required declarations and signature.
• Scroll-to-end detection blocks ToU/Privacy checkboxes until reached.
• PDF receipt generated with accurate consent values and timestamps.
• Email with receipt link/attachment is delivered.
• Audit entries present and immutable (attempted edits create new row, not overwrite).
• Re-login shows accepted versions; if versions updated, re-consent is required.
10) Text-Based Flow Diagram
Stage 4 Complete
↓
/onboarding/declarations (Step 5/6)
↓
Review Regulatory → ToU → Privacy → Conflicts/Complaints → No-Referral
↓ (Check all required boxes; scroll-gates enforced)
Signature (typed + drawn) + final confirm
↓
POST declarations → persist + generate PDF receipt → email
↓
Set declarations_complete = true; onboarding_stage = "verification"
↓
Proceed to Stage 6: Admin Verification & Activation
User Flow — Stage 6: Admin Verification &
Activation
Objective
Give compliance/admin staff a robust dashboard to verify eligibility, documents, and
declarations; record an immutable audit; and either Approve, Request Changes, or Reject
the application. On approval, automatically activate the account.
1) Entry Point
Trigger: Stage 5 completed (declarations_complete = true).
System sets: onboarding_stage = "verification", application_status =
"pending_review".
Admin route: /admin/barristers/review → list of pending applicants.
2) Admin Dashboard — Review Queue
2.1 Queue List (table)
Columns:
• Applicant name & email
• Year of call
• BSB number
• Submitted at (timestamp)
• SLA ticker (e.g., “Due in 2d 4h”)
• Status chip: Pending / In review / Awaiting applicant / Approved / Rejected
• Actions: Open, Assign, Archive
Filters:
• Status, Area of practice, Year of call (range), Country, Age of documents (e.g., > 30
days old)
Bulk actions:
• Assign to reviewer, Export CSV
3) Review Workspace (Admin → Applicant Detail)
Tabbed layout:
1. Overview
o Identity: Name, email, BSB #, year of call
o Eligibility responses (from Stage 1)
o Subscription status & plan (from Stage 4)
o Declarations summary (from Stage 5)
o Risk flags (see §7)
2. Documents
o Practising Certificate (preview + download)
o Public Access accreditation proof
o BMIF insurance proof
o Qualified Person details (if <3 years’ call)
o Status per doc: Pending / Verified / Rejected
o Buttons: Verify, Reject with reason, Replace (request)
3. Profile
o Public profile preview (read-only)
o Transparency (pricing model, key stages & timescales)
o Areas of practice & services
o Mandatory BSB link present (yes/no)
4. Checks
o BSB Register: link-out to search prefilled with name/BSB #
o Insurance: coverage end date; “within 30 days of expiry?” flag
o Sanctions/PEP (optional): if integrated
o Notes: internal comments thread (tag colleagues, @ mentions)
5. Audit & Activity
o Timeline of actions (uploads, edits, reviewer decisions)
o IP, timestamps, reviewer IDs
4) Verification Steps & Logic
4.1 Identity & Authorisation
• Cross-check Name, Year of Call, BSB # against BSB Register.
• Confirm Public Access authorisation is present on register (or via provided proof).
4.2 Document Verification
• Practising certificate: valid dates, correct name.
• Public Access accreditation: certificate or register proof.
• BMIF insurance: valid to date ≥ today + 30 days recommended (configurable).
• <3 years’ call: Qualified Person details seem credible (optional contact).
4.3 Profile Compliance
• Transparency fields populated (pricing model + key stages & timescales).
• BSB lay client guidance link is visible.
• Bio present; no prohibited claims (e.g., misrepresenting as a solicitor).
4.4 Declarations & Signature
• Confirm consent record exists with versioned ToU/Privacy, signature, timestamps,
IP.
5) Decision States
A) Approve
• Set: verification_status = "approved", application_status = "approved".
• Set: account_status = "active", profile_published = true.
• System actions:
o Send Approval email with “Get started” link.
o Create next review date (e.g., 12 months) for re-verification.
o Schedule insurance/practising certificate expiry reminders.
B) Request Changes (aka “Refer back”)
• Set: application_status = "awaiting_applicant".
• Admin selects change reasons (multi-select + freeform notes):
o Document unclear/expired
o Public Access proof missing
o Transparency fields incomplete
o Profile claims require edits
• System actions:
o Email applicant with itemised checklist and secure re-upload link.
o Keep profile unpublished.
o SLA pauses/resets per policy.
C) Reject
• Set: application_status = "rejected", account_status = "restricted".
• Require reason code + optional narrative.
• System actions:
o Email notice with clear reasons and re-apply window if allowed (e.g., after 90
days).
o Keep all records for audit.
6) Notifications
To Applicant
• Submission received (Stage 2) — already sent earlier.
• Changes requested — with checklist and button to resume.
• Approved — onboarding complete; link to dashboard, best practices.
• Rejected — reasons + support contact.
To Admin
• New pending application alert (daily digest or immediate).
• SLA breaches (e.g., > 72h pending) — Slack/email.
7) Risk Flags (automated)
• Imminent Expiry: BMIF or practising certificate expires ≤ 30 days.
• Data mismatch: Name or year of call doesn’t match BSB register.
• Under 3 years’ call: Requires Qualified Person details.
• Transparency weak: Missing key stages & timescales or pricing model.
• Multiple revisions: > 3 resubmissions.
Flags render as chips on Overview and gate Approve until cleared (configurable overrides
for admins with reason entry).
8) Post-Approval Automations
• Create renewal tasks:
o Practising certificate re-upload reminder at T-60, T-30, T-7 days.
o BMIF insurance re-upload reminder at T-60, T-30, T-7 days.
• Annual re-verification prompt: confirm details still accurate; diff any changes.
• If expiry passes without update → auto-unpublish profile and email warnings.
9) Developer Notes (Data Model & API)
9.1 Schema Additions
barrister_applications
id UUID PK,
user_id UUID UNIQUE NOT NULL,
application_status TEXT NOT NULL,
--
pending_review|in_review|awaiting_applicant|approved|rejected
verification_status TEXT, -- approved|rejected|partial
risk_flags TEXT[], --
['expiry_soon','bsb_mismatch',...]
reviewer_id UUID,
review_started_at TIMESTAMP,
decision_at TIMESTAMP,
decision_reason_code TEXT,
decision_notes TEXT,
next_review_at TIMESTAMP,
created_at TIMESTAMP,
updated_at TIMESTAMP
);
document_verifications
id UUID PK,
user_id UUID NOT NULL,
doc_type TEXT, --
practising_cert|public_access|bmif|qualified_person
status TEXT, -- pending|verified|rejected
notes TEXT,
verified_by UUID,
verified_at TIMESTAMP,
created_at TIMESTAMP
);
profile_publication
user_id UUID PK,
profile_published BOOLEAN DEFAULT FALSE,
published_at TIMESTAMP,
unpublished_at TIMESTAMP,
reason TEXT
);
9.2 Endpoints (Admin)
• GET /api/admin/barristers?status=pending_review
• GET /api/admin/barristers/{userId}
• POST /api/admin/barristers/{userId}/verify-doc
• POST /api/admin/barristers/{userId}/decision {decision:
'approve'|'changes'|'reject', reasons:[...], notes:''}
• POST /api/admin/barristers/{userId}/publish
• POST /api/admin/barristers/{userId}/unpublish
9.3 Security
• Admin-only routes (RBAC).
• Idempotency on decisions.
• Immutable audit trail (append-only).
10) Security & Compliance
• WORM/append-only audit for key events (uploads, decisions, publication).
• Signed URLs for document access; scope-limited; short TTL.
• PII minimisation in logs; encrypt at rest (KMS).
• Change freeze after approval: profile edits trigger light re-check queue if sensitive
fields change (name, BSB #, authorisation, pricing model).
11) QA / Acceptance Criteria
• Admin cannot Approve unless: all required docs Verified, essential profile fields
present, no blocking risk flags.
• Request Changes sends itemised email with checklist and re-upload link.
• Approve sets profile_published = true and account visible in search within ≤ 5
minutes.
• Expiry reminders created on approval with correct due dates.
• All actions appear in Audit & Activity with accurate timestamps and actor IDs.
• Re-submission re-opens the review with prior context preserved.
12) Text-Based Flow Diagram
Stage 5 Complete → application_status = pending_review
↓
Admin Queue → Open Applicant
↓
Verify Identity/Docs/Profile/Declarations
↓
[Decision]
├─ Approve → publish profile → send approval → schedule renewals
├─ Request Changes → email checklist → await resubmission
└─ Reject → email reasons → archive app