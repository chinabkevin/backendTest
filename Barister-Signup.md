Developer Requirement Document for implementing the Barrister 
Sign-Up Flow on the  Advoqat platform. 
It translates your compliance, legal, and operational requirements into clear technical  specifications your developers can build directly from. 
Developer Requirement Document Project: Advoqat Barrister Sign-Up & Verification System Version: 1.0 
Prepared for: Development Team 
1. Purpose 
This document defines the functional, technical, and compliance requirements for  implementing the Barrister Sign-Up process within the Advoqat legal-tech platform. The goal is to onboard qualified Public Access Barristers in compliance with Bar  Standards Board (BSB) and Public Access Rules. 
2. Core Objective 
Enable barristers to: 
• Create verified profiles on Advoqat 
• Submit compliance documents (Public Access, BMIF, Practising Certificate) • Select subscription plans 
• Accept platform and regulatory terms 
• Undergo compliance verification before activation 
3. User Flow Overview 
Flow Steps 
1. Eligibility Check 
2. Document Upload 
3. Professional Information Entry 
4. Subscription Selection 
5. Legal Declaration & Terms Acceptance 
6. Admin Compliance Verification 
7. Account Activation 
See “Barrister Onboarding Flow Diagram” for reference.
4. Functional Requirements 
4.1 Registration Module 
Purpose: Allow a new barrister to initiate onboarding via web or mobile. 
Feature 
Barrister Sign-Up  Form 
Authentication 
Eligibility  
Confirmation
Description 
Requirements 
Fields: Full name, email, contact number,  year of call, BSB number 
OAuth or Firebase Auth; support  password reset 
Must check all before continuing Send verification link via email
Form to collect personal and  regulatory details
Secure account creation 
Checkbox checklist of  
mandatory criteria 
Email Verification Verify user’s email address 



4.2 Document Upload Module 
Purpose: Collect required regulatory documents. 
Document 
Practising Certificate 
Public Access Accreditation BMIF Insurance Proof 
Qualified Person (if <3 years call) Conditional 
Requirement 
Validation 
File type: PDF/JPG, <5MB File type: PDF/JPG, <5MB File type: PDF/JPG, <5MB Optional text field or file upload
Mandatory 
Mandatory 
Mandatory 





UI Components: 
• Progress indicator (Step 2 of 6) 
• “Upload” button per document 
• Status badge: Pending / Verified / Expired 
4.3 Profile Setup Module 
Purpose: Gather professional and transparency information for public profile.
Field 
Full Name 
Chambers / Practice Address Text Areas of Practice 
Services Offered 
Pricing Model 
Hourly Rate / Example Fee 
Type 
Validation Required Optional 
Required Required  
Optional
Text 


Multi-select dropdown 
Text 
Dropdown (Hourly, Fixed Fee, Package) Required
Numeric 



Field 
Public Access Authorisation Checkbox confirmation “Regulated by” Tag 
Link to BSB Guidance 
Type 
Validation Required Read-only Fixed URL


Auto-generated text 
Auto-link 



4.4 Subscription & Payment Module 
Purpose: Allow barristers to choose a subscription plan. 
Description 
Price 
Profile listing, limited visibility 
£0 
Professional Full visibility, messaging, bookings £49.99/month Default





Plan Notes Basic Trial only 
 
Premium Boosted visibility, analytics £79.99/month Optional Requirements: 
• Integration with Stripe or Paddle for recurring billing 
• Auto-renewal toggle 
• Invoice breakdown showing: 
o “Advoqat Platform Admin Fee” (for transparency) 
o “Barrister Legal Fee” (not processed by Advoqat) 
4.5 Legal Declarations & Consent Module 
Purpose: Capture legal agreements required for compliance. 
Declaration 
BSB Authorisation Confirmation Checkbox BMIF Insurance Confirmation Public Access Compliance Advoqat Terms of Use 
Signature 
Type 
Requirement Required 
Required 
Required 
 
Required


Checkbox 
Checkbox 
Scrollable modal with checkbox Required
Digital (type or draw) 



Final Action: 
Submit → triggers “Pending Verification” state. 
4.6 Verification & Admin Dashboard 
Purpose: Internal module for Advoqat compliance staff.
Function 
View Submitted Applications List of pending barristersReview Documents 
Verify BSB Registration 
Auto-reminder 
Audit Logs 
Description


Preview uploads and verify authenticity
Integration or manual link to BSB Register
Approve / Reject Application Change status → triggers email notification
Email barrister if BMIF/Practising Cert expiring in 30 days
Record all changes (user ID, timestamp, reviewer)



5. Technical Specifications 
Aspect 
Frontend Stack 
Backend Stack 
Database 
Storage 
Auth 
Payment Gateway 
Compliance Dashboard Email Service 
API Security 
Logging & Audit 
Specification 
React (Next.js) or Vue.js 
Spring Boot (Java) 
PostgreSQL 
AWS S3 / Firebase Storage for documents Firebase Authentication 
Stripe (subscription API) 
React Admin Panel 
SendGrid / AWS SES 
JWT tokens; role-based access (Barrister / Admin) Spring Boot audit logging + PostgreSQL history table



6. Compliance & Security Controls 
• Use HTTPS and data encryption (AES-256 at rest, TLS in transit). • Document uploads must be stored securely, with restricted admin access only. • Implement annual re-verification reminder for barristers. 
• Maintain audit trail of all changes for regulatory inspection. 
• Explicitly display “Regulated by the Bar Standards Board” tag on each public  barrister profile. 
• Include link to BSB Public Access Guidance for Lay Clients on all profile and  booking pages. 
7. Acceptance Criteria
Requirement 
Uploads validate & store securely BSB fields validated 
Acceptance Test
QA verifies file persistence & permissions
Subscription payment processed via Stripe Payment succeeds + webhook triggers “Active”
BSB number required before submission



Requirement 
Admin approval required before public  listing 
Audit logs captured 
Expiry reminders 
Acceptance Test 
Profile visible only after “Verified” 
Each status change logged in DB 
Email triggered automatically 30 days before  expiry



8. Deliverables 
• Frontend Sign-Up Flow (6 steps) 
• Admin Compliance Dashboard 
• Stripe Subscription Integration 
• Document Upload + Verification Workflow 
• API Endpoints for all modules 
• Email Notification Templates 
• Audit & Security Logging 
9. Milestones (Suggested Timeline)
Milestone 
Week 7 
Week 8 
Duration 
Deliverable 
Week 1–2 UX/UI design + API spec Wireframes + Flow mockup Spring Boot endpoints + DB schema Week 5–6 Frontend implementation React flow + Stripe integration  
Production-ready build


Week 3–4 Backend development 


Admin dashboard & QA Compliance tools tested
Go-live & UAT 