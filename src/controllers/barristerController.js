import { sql } from '../config/db.js';
import { createNotification } from './notificationController.js';
import { sendDocumentUploadConfirmation, sendBarristerWelcomeEmail } from '../utils/emailService.js';
import { uploadToCloudinary } from '../utils/fileUpload.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import fs from 'fs';
import stripe from '../config/stripe.js';

// Helper function to upload to Cloudinary for barrister documents
const uploadBarristerDocument = async (file, barristerId, documentType) => {
  return uploadToCloudinary(file, `barristers/${barristerId}`, documentType);
};

// Calculate file hash for integrity verification
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

// Calculate file hash from buffer
const calculateFileHashFromBuffer = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Stage 1: Register barrister account with eligibility check
 * POST /api/barrister/register
 * Combines account registration + eligibility criteria
 */
export async function registerBarrister(req, res) {
  try {
    const { 
      supabaseId, 
      email, 
      name, 
      phone, 
      password, 
      yearOfCall,
      bsbNumber,
      agreeToTerms,
      // Eligibility answers
      hasPractisingCertificate,
      isPublicAccessRegistered,
      hasPublicAccessTraining,
      hasBmifInsurance,
      inGoodStanding,
      underThreeYearsWithSupervisor,
      supervisorDetails
    } = req.body;
    
    const identityId = supabaseId || crypto.randomUUID();

    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name, password'
      });
    }

    if (!yearOfCall || !bsbNumber) {
      return res.status(400).json({
        success: false,
        error: 'Year of call and BSB number are required'
      });
    }

    if (!agreeToTerms) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to join Advoqat as a Public Access Barrister'
      });
    }

    // Validate eligibility criteria
    if (!hasPractisingCertificate || !isPublicAccessRegistered || 
        !hasPublicAccessTraining || !hasBmifInsurance || !inGoodStanding) {
      return res.status(400).json({
        success: false,
        error: 'All eligibility criteria must be met'
      });
    }

    // If under 3 years, supervisor details required
    if (underThreeYearsWithSupervisor === 'yes' && !supervisorDetails) {
      return res.status(400).json({
        success: false,
        error: 'Supervisor details are required if you are under 3 years\' call'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    let user = await sql`
      SELECT id, onboarding_stage, profile_status 
      FROM "user" 
      WHERE supabase_id = ${identityId} OR email = ${email}
    `;

    const eligibilityAnswers = {
      hasPractisingCertificate,
      isPublicAccessRegistered,
      hasPublicAccessTraining,
      hasBmifInsurance,
      inGoodStanding,
      underThreeYearsWithSupervisor,
      supervisorDetails: supervisorDetails || null
    };

    const eligibilityPassed = true; // All criteria validated above

    if (user.length > 0) {
      const dbUserId = user[0].id;
      
      // Update existing user
      user = await sql`
        UPDATE "user"
        SET 
          email = ${email},
          name = ${name},
          phone = ${phone || null},
          year_of_call = ${yearOfCall},
          bsb_number = ${bsbNumber},
          role = 'barrister',
          onboarding_stage = 'documents_upload',
          profile_status = 'pending',
          eligibility_passed = ${eligibilityPassed},
          updated_at = NOW()
        WHERE supabase_id = ${identityId} OR email = ${email}
        RETURNING id, email, name, role, onboarding_stage, profile_status
      `;

      // Update or create eligibility record
      const existingEligibility = await sql`
        SELECT id FROM barrister_eligibility WHERE user_id = ${dbUserId}
      `;

      if (existingEligibility.length > 0) {
        await sql`
          UPDATE barrister_eligibility
          SET 
            answers = ${JSON.stringify(eligibilityAnswers)},
            eligibility_passed = ${eligibilityPassed},
            updated_at = NOW()
          WHERE user_id = ${dbUserId}
        `;
      } else {
        await sql`
          INSERT INTO barrister_eligibility (user_id, answers, eligibility_passed)
          VALUES (${dbUserId}, ${JSON.stringify(eligibilityAnswers)}, ${eligibilityPassed})
        `;
      }
    } else {
      // Create new user
      user = await sql`
        INSERT INTO "user" (supabase_id, email, name, phone, year_of_call, bsb_number, role, onboarding_stage, profile_status, eligibility_passed)
        VALUES (${identityId}, ${email}, ${name}, ${phone || null}, ${yearOfCall}, ${bsbNumber}, 'barrister', 'documents_upload', 'pending', ${eligibilityPassed})
        RETURNING id, email, name, role, onboarding_stage, profile_status
      `;

      // Create eligibility record
      await sql`
        INSERT INTO barrister_eligibility (user_id, answers, eligibility_passed)
        VALUES (${user[0].id}, ${JSON.stringify(eligibilityAnswers)}, ${eligibilityPassed})
      `;
    }

    logger.log('Barrister account registered with eligibility:', {
      userId: user[0].id,
      email: user[0].email,
      stage: user[0].onboarding_stage
    });

    try {
      await sendBarristerWelcomeEmail(user[0].email, user[0].name);
      logger.log('Barrister welcome email sent:', { email: user[0].email });
    } catch (emailError) {
      logger.error('Error sending welcome email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Registration and eligibility check completed successfully',
      data: {
        userId: user[0].id,
        email: user[0].email,
        name: user[0].name,
        onboardingStage: user[0].onboarding_stage,
        profileStatus: user[0].profile_status,
        eligibilityPassed: true
      }
    });
  } catch (error) {
    logger.error('Error registering barrister:', error);
    
    // Handle duplicate email
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to register barrister account'
    });
  }
}

/**
 * Stage 2: Submit eligibility criteria
 * POST /api/barrister/eligibility
 */
export async function submitEligibility(req, res) {
  try {
    const { userId, answers } = req.body;
    
    if (!userId || !answers) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, answers'
      });
    }

    // Get user
    const user = await sql`
      SELECT id, supabase_id 
      FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Validate eligibility answers
    const requiredAnswers = [
      'hasPractisingCertificate',
      'isPublicAccessRegistered',
      'hasPublicAccessTraining',
      'hasBmifInsurance',
      'inGoodStanding'
    ];

    const missingAnswers = requiredAnswers.filter(key => answers[key] === undefined);
    if (missingAnswers.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing eligibility answers: ${missingAnswers.join(', ')}`
      });
    }

    // Validate all required criteria are met
    const eligibilityPassed = 
      answers.hasPractisingCertificate === true &&
      answers.isPublicAccessRegistered === true &&
      answers.hasPublicAccessTraining === true &&
      answers.hasBmifInsurance === true &&
      answers.inGoodStanding === true;

    // If under 3 years, validate supervisor details
    if (answers.underThreeYearsWithSupervisor === 'yes' || answers.underThreeYearsWithSupervisor === true) {
      if (!answers.supervisorDetails || answers.supervisorDetails.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Supervisor details are required if under 3 years\' call'
        });
      }
    }

    // Check if eligibility record already exists
    const existingEligibility = await sql`
      SELECT id FROM barrister_eligibility WHERE user_id = ${dbUserId}
    `;

    let eligibility;
    if (existingEligibility.length > 0) {
      // Update existing record
      eligibility = await sql`
        UPDATE barrister_eligibility
        SET 
          answers = ${JSON.stringify(answers)},
          eligibility_passed = ${eligibilityPassed},
          updated_at = NOW()
        WHERE user_id = ${dbUserId}
        RETURNING *
      `;
    } else {
      // Insert new record
      eligibility = await sql`
        INSERT INTO barrister_eligibility (user_id, answers, eligibility_passed)
        VALUES (${dbUserId}, ${JSON.stringify(answers)}, ${eligibilityPassed})
        RETURNING *
      `;
    }

    if (!eligibilityPassed) {
      return res.status(400).json({
        success: false,
        error: 'Eligibility criteria not met. Please review your answers.',
        eligibilityPassed: false
      });
    }

    // Update user record
    await sql`
      UPDATE "user"
      SET 
        eligibility_passed = true,
        onboarding_stage = 'documents_upload',
        updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    logger.log('Barrister eligibility submitted:', {
      userId: dbUserId,
      eligibilityPassed,
      stage: 'documents_upload'
    });

    res.status(200).json({
      success: true,
      message: 'Eligibility criteria validated successfully',
      data: {
        eligibilityPassed: true,
        onboardingStage: 'documents_upload',
        answers: eligibility[0].answers
      }
    });
  } catch (error) {
    logger.error('Error submitting eligibility:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to submit eligibility criteria'
    });
  }
}

/**
 * Upload barrister documents
 * POST /api/barristers/upload-documents
 */
export async function uploadBarristerDocuments(req, res) {
  try {
    const { userId, qualifiedPersonName, qualifiedPersonEmail } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Get user information
    const numericUserId = parseInt(userId, 10);
    const user = await sql`
      SELECT id, email, name, supabase_id 
      FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${Number.isNaN(numericUserId) ? 0 : numericUserId}
    `;

    if (user.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const dbUserId = user[0].id;
    const userEmail = user[0].email;
    const userName = user[0].name;

    // Validate required files
    const requiredFiles = ['practisingCertificate', 'publicAccessAccreditation', 'bmifInsurance'];
    const missingFiles = [];

    for (const fileType of requiredFiles) {
      if (!req.files || !req.files[fileType] || req.files[fileType].length === 0) {
        missingFiles.push(fileType);
      }
    }

    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required documents: ${missingFiles.join(', ')}`
      });
    }

    // Upload files to Cloudinary and calculate hashes
    const documentUrls = {};
    const documentHashes = {};
    const uploadErrors = [];

    for (const fileType of requiredFiles) {
      const file = req.files[fileType][0];
      try {
        // Calculate hash before upload (file will be deleted after upload)
        let fileHash = null;
        if (file.path && fs.existsSync(file.path)) {
          try {
            fileHash = await calculateFileHash(file.path);
            documentHashes[fileType] = fileHash;
          } catch (hashError) {
            logger.error(`Error calculating hash for ${fileType}:`, hashError);
          }
        }

        const uploadResult = await uploadBarristerDocument(file, dbUserId, fileType);
        if (uploadResult.success) {
          documentUrls[fileType] = uploadResult.url;
        } else {
          uploadErrors.push(`${fileType}: ${uploadResult.error}`);
        }
      } catch (error) {
        logger.error(`Error uploading ${fileType}:`, error);
        uploadErrors.push(`${fileType}: ${error.message}`);
      }
    }

    // Handle qualified person document if provided
    if (req.files && req.files.qualifiedPersonDocument && req.files.qualifiedPersonDocument.length > 0) {
      const file = req.files.qualifiedPersonDocument[0];
      try {
        // Calculate hash before upload
        let fileHash = null;
        if (file.path && fs.existsSync(file.path)) {
          try {
            fileHash = await calculateFileHash(file.path);
            documentHashes.qualifiedPersonDocument = fileHash;
          } catch (hashError) {
            logger.error('Error calculating hash for qualified person document:', hashError);
          }
        }

        const uploadResult = await uploadBarristerDocument(file, dbUserId, 'qualifiedPersonDocument');
        if (uploadResult.success) {
          documentUrls.qualifiedPersonDocument = uploadResult.url;
        }
      } catch (error) {
        logger.error('Error uploading qualified person document:', error);
        // Don't fail the whole request if this optional document fails
      }
    }

    if (uploadErrors.length > 0) {
      return res.status(500).json({
        success: false,
        error: `Failed to upload some documents: ${uploadErrors.join(', ')}`
      });
    }

    // Save documents to barrister_documents table with file hashes
    const documentTypes = {
      'practisingCertificate': 'practising_certificate',
      'publicAccessAccreditation': 'public_access_accreditation',
      'bmifInsurance': 'bmif_insurance',
      'qualifiedPersonDocument': 'qualified_person_document'
    };

    const uploadedDocuments = [];

    for (const [fileKey, docType] of Object.entries(documentTypes)) {
      if (documentUrls[fileKey]) {
        const fileHash = documentHashes[fileKey] || null;

        // Check if document already exists
        const existingDoc = await sql`
          SELECT id FROM barrister_documents 
          WHERE user_id = ${dbUserId} AND document_type = ${docType}
        `;

        if (existingDoc.length > 0) {
          // Update existing document
          const updatedDoc = await sql`
            UPDATE barrister_documents
            SET 
              file_url = ${documentUrls[fileKey]},
              file_hash = ${fileHash},
              status = 'pending',
              uploaded_at = NOW(),
              updated_at = NOW()
            WHERE id = ${existingDoc[0].id}
            RETURNING *
          `;
          uploadedDocuments.push(updatedDoc[0]);

          // Create audit log
          await sql`
            INSERT INTO barrister_document_audit_logs (document_id, user_id, action, old_status, new_status, notes)
            VALUES (${existingDoc[0].id}, ${dbUserId}, 'updated', 'pending', 'pending', 'Document re-uploaded')
          `;
        } else {
          // Insert new document
          const newDoc = await sql`
            INSERT INTO barrister_documents (user_id, document_type, file_url, file_hash, status)
            VALUES (${dbUserId}, ${docType}, ${documentUrls[fileKey]}, ${fileHash}, 'pending')
            RETURNING *
          `;
          uploadedDocuments.push(newDoc[0]);

          // Create audit log
          await sql`
            INSERT INTO barrister_document_audit_logs (document_id, user_id, action, old_status, new_status, notes)
            VALUES (${newDoc[0].id}, ${dbUserId}, 'uploaded', NULL, 'pending', 'Initial document upload')
          `;
        }
      }
    }

    // Update or create barrister record for qualified person info
    if (qualifiedPersonName || qualifiedPersonEmail) {
      const barristerExists = await sql`SELECT id FROM barrister WHERE user_id = ${dbUserId}`;
      
      if (barristerExists.length > 0) {
        await sql`
          UPDATE barrister 
          SET 
            qualified_person_name = ${qualifiedPersonName || null},
            qualified_person_email = ${qualifiedPersonEmail || null},
            updated_at = NOW()
          WHERE user_id = ${dbUserId}
        `;
      } else {
        await sql`
          INSERT INTO barrister (user_id, name, email, qualified_person_name, qualified_person_email)
          VALUES (${dbUserId}, ${userName}, ${userEmail}, ${qualifiedPersonName || null}, ${qualifiedPersonEmail || null})
        `;
      }
    }

    // Update user status and onboarding stage
    await sql`
      UPDATE "user"
      SET 
        profile_status = 'PENDING_VERIFICATION',
        onboarding_stage = 'document_upload_completed',
        updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    // Create notification for admin (find admin users or create a system notification)
    try {
      const admins = await sql`
        SELECT id, supabase_id FROM "user" WHERE role = 'admin'
      `;

      if (admins.length > 0) {
        for (const admin of admins) {
          await createNotification(
            admin.supabase_id,
            'barrister_document_upload',
            'New Barrister Document Upload',
            `A barrister (${userName}) has uploaded documents and is pending verification.`,
            {
              barrister_id: barrister[0].id,
              user_id: dbUserId,
              status: 'PENDING_VERIFICATION',
              stage: 'document_upload_completed'
            }
          );
        }
      }
    } catch (notificationError) {
      logger.error('Error creating admin notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Send email confirmation to user
    try {
      await sendDocumentUploadConfirmation(userEmail, userName);
      logger.log('Document upload confirmation email sent:', { email: userEmail });
    } catch (emailError) {
      logger.error('Error sending confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedDocuments,
        status: 'PENDING_VERIFICATION',
        stage: 'document_upload_completed',
        documentsCount: uploadedDocuments.length
      }
    });

  } catch (error) {
    logger.error('Error uploading barrister documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload documents. Please try again.'
    });
  }
}

/**
 * Get barrister by user ID
 * GET /api/barristers/:userId
 */
/**
 * Stage 3: Save professional information
 * POST /api/barrister/professional-info
 */
export async function saveProfessionalInfo(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    // Get user from database
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId} OR id = ${parseInt(userId)}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const {
      chambersName,
      practiceAddress,
      areasOfPractice, // Array of strings
      servicesOffered,
      pricingModel, // 'hourly', 'fixed_fee', 'package'
      hourlyRate,
      exampleFee,
      publicAccessAuthorisation
    } = req.body;

    // Validate required fields
    if (!chambersName || !practiceAddress) {
      return res.status(400).json({
        success: false,
        error: 'Chambers name and practice address are required'
      });
    }

    if (!pricingModel || !['hourly', 'fixed_fee', 'package'].includes(pricingModel)) {
      return res.status(400).json({
        success: false,
        error: 'Valid pricing model is required (hourly, fixed_fee, or package)'
      });
    }

    if (pricingModel === 'hourly' && (!hourlyRate || hourlyRate <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Hourly rate is required and must be greater than 0'
      });
    }

    // Check if professional info already exists
    const existingInfo = await sql`
      SELECT id FROM barrister_professional_info WHERE user_id = ${dbUserId}
    `;

    // Ensure areasOfPractice is an array (Neon handles JavaScript arrays directly)
    const areasArray = Array.isArray(areasOfPractice) 
      ? areasOfPractice 
      : (areasOfPractice ? [areasOfPractice] : []);

    let professionalInfo;
    if (existingInfo.length > 0) {
      // Update existing record
      professionalInfo = await sql`
        UPDATE barrister_professional_info
        SET 
          chambers_name = ${chambersName},
          practice_address = ${practiceAddress},
          areas_of_practice = ${areasArray},
          services_offered = ${servicesOffered || null},
          pricing_model = ${pricingModel},
          hourly_rate = ${hourlyRate ? parseFloat(hourlyRate) : null},
          example_fee = ${exampleFee ? parseFloat(exampleFee) : null},
          public_access_authorisation = ${publicAccessAuthorisation || false},
          updated_at = NOW()
        WHERE user_id = ${dbUserId}
        RETURNING *
      `;
    } else {
      // Insert new record
      professionalInfo = await sql`
        INSERT INTO barrister_professional_info (
          user_id, chambers_name, practice_address, areas_of_practice,
          services_offered, pricing_model, hourly_rate, example_fee,
          public_access_authorisation
        )
        VALUES (
          ${dbUserId}, ${chambersName}, ${practiceAddress}, 
          ${areasArray},
          ${servicesOffered || null}, ${pricingModel},
          ${hourlyRate ? parseFloat(hourlyRate) : null},
          ${exampleFee ? parseFloat(exampleFee) : null},
          ${publicAccessAuthorisation || false}
        )
        RETURNING *
      `;
    }

    // Update user onboarding stage
    await sql`
      UPDATE "user"
      SET onboarding_stage = 'subscription_selection',
          updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    logger.log('Professional information saved:', {
      userId: dbUserId,
      stage: 'subscription_selection'
    });

    res.status(200).json({
      success: true,
      message: 'Professional information saved successfully',
      data: {
        professionalInfo: professionalInfo[0],
        onboardingStage: 'subscription_selection'
      }
    });
  } catch (error) {
    logger.error('Error saving professional information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save professional information'
    });
  }
}

/**
 * Stage 4: Select subscription plan
 * POST /api/barrister/subscription
 */
const upsertBarristerSubscriptionRecord = async ({
  dbUserId,
  planType,
  autoRenewal,
  stripeSubscriptionId = null,
  stripeCustomerId = null,
  status,
  expiresAt = null
}) => {
  const existingSubscription = await sql`
    SELECT id FROM barrister_subscription 
    WHERE user_id = ${dbUserId}
  `;

  if (existingSubscription.length > 0) {
    const updated = await sql`
      UPDATE barrister_subscription
      SET 
        plan_type = ${planType},
        stripe_subscription_id = ${stripeSubscriptionId || null},
        stripe_customer_id = ${stripeCustomerId || null},
        status = ${status},
        auto_renewal = ${autoRenewal},
        expires_at = ${expiresAt},
        updated_at = NOW()
      WHERE user_id = ${dbUserId}
      RETURNING *
    `;
    return updated[0];
  }

  const inserted = await sql`
    INSERT INTO barrister_subscription (
      user_id, plan_type, stripe_subscription_id, stripe_customer_id,
      status, auto_renewal, started_at, expires_at
    )
    VALUES (
      ${dbUserId}, ${planType}, ${stripeSubscriptionId || null}, ${stripeCustomerId || null},
      ${status}, ${autoRenewal}, NOW(), ${expiresAt}
    )
    RETURNING *
  `;

  return inserted[0];
};

export async function selectSubscription(req, res) {
  try {
    const { userId, planType, autoRenewal = true } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    if (!planType || !['basic', 'professional', 'premium'].includes(planType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid plan type is required (basic, professional, or premium)'
      });
    }

    // Get user from database
    const user = await sql`
      SELECT id, email, name, supabase_id 
      FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId)}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Plan pricing (in pence for Stripe)
    const planPricing = {
      basic: 0, // Free
      professional: 4999, // £49.99/month
      premium: 7999 // £79.99/month
    };

    const price = planPricing[planType];

    // Paid plans: initiate Stripe Checkout session
    if (planType !== 'basic') {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                unit_amount: price,
                recurring: {
                  interval: 'month'
                },
                product_data: {
                  name: `Advoqat ${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
                  description: 'Monthly subscription for barristers'
                }
              },
              quantity: 1
            }
          ],
          customer_email: user[0].email,
          metadata: {
            planType,
            autoRenewal: autoRenewal ? 'true' : 'false',
            dbUserId: dbUserId.toString(),
            supabaseId: user[0].supabase_id || ''
          },
          success_url: `${frontendUrl}/signup/barrister/subscription?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/signup/barrister/subscription?cancelled=1`
        });

        await sql`
          UPDATE "user"
          SET onboarding_stage = 'subscription_payment_pending',
              updated_at = NOW()
          WHERE id = ${dbUserId}
        `;

        logger.log('Stripe checkout session created for subscription', {
          userId: dbUserId,
          planType,
          sessionId: session.id
        });

        return res.status(200).json({
          success: true,
          message: 'Stripe checkout session created',
          data: {
            requiresPayment: true,
            checkoutSessionId: session.id,
            checkoutUrl: session.url
          }
        });
      } catch (stripeError) {
        logger.error('Stripe checkout session error:', stripeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to initiate subscription payment. Please try again.'
        });
      }
    }

    // Basic plan: activate immediately
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subscription = await upsertBarristerSubscriptionRecord({
      dbUserId,
      planType,
      autoRenewal,
      status: 'active',
      expiresAt
    });

    await sql`
      UPDATE "user"
      SET onboarding_stage = 'legal_declarations',
          updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    logger.log('Subscription selected:', {
      userId: dbUserId,
      planType,
      stage: 'legal_declarations'
    });

    res.status(200).json({
      success: true,
      message: 'Subscription selected successfully',
      data: {
        subscription,
        onboardingStage: 'legal_declarations',
        requiresPayment: false
      }
    });
  } catch (error) {
    logger.error('Error selecting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to select subscription'
    });
  }
}

export async function confirmBarristerSubscription(req, res) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.mode !== 'subscription') {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported Stripe session'
      });
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({
        success: false,
        error: 'Subscription payment has not been completed'
      });
    }

    const metadata = session.metadata || {};
    const planType = metadata.planType;
    const autoRenewal = metadata.autoRenewal === 'true';
    const dbUserId = metadata.dbUserId ? parseInt(metadata.dbUserId, 10) : null;

    if (!dbUserId || !planType) {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription metadata'
      });
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null;

    const subscription = await upsertBarristerSubscriptionRecord({
      dbUserId,
      planType,
      autoRenewal,
      stripeSubscriptionId,
      stripeCustomerId,
      status: 'active',
      expiresAt: null
    });

    await sql`
      UPDATE "user"
      SET onboarding_stage = 'legal_declarations',
          updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    logger.log('Barrister subscription confirmed via Stripe', {
      userId: dbUserId,
      planType,
      sessionId
    });

    res.status(200).json({
      success: true,
      message: 'Subscription confirmed successfully',
      data: {
        subscription,
        onboardingStage: 'legal_declarations'
      }
    });
  } catch (error) {
    logger.error('Error confirming subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm subscription payment'
    });
  }
}

/**
 * Stage 5: Submit legal declarations
 * POST /api/barrister/legal-declarations
 */
export async function submitLegalDeclarations(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    // Get user from database
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId} OR id = ${parseInt(userId)}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const {
      bsbAuthorisationConfirmed,
      bmifInsuranceConfirmed,
      publicAccessComplianceConfirmed,
      advoqatTermsAccepted,
      privacyConsentConfirmed,
      digitalSignature
    } = req.body;

    // Validate all declarations are confirmed
    if (!bsbAuthorisationConfirmed || !bmifInsuranceConfirmed || 
        !publicAccessComplianceConfirmed || !advoqatTermsAccepted || 
        !privacyConsentConfirmed) {
      return res.status(400).json({
        success: false,
        error: 'All legal declarations must be confirmed'
      });
    }

    if (!digitalSignature || digitalSignature.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Digital signature is required'
      });
    }

    // Check if declarations already exist
    const existingDeclarations = await sql`
      SELECT id FROM barrister_legal_declarations WHERE user_id = ${dbUserId}
    `;

    let declarations;
    if (existingDeclarations.length > 0) {
      // Update existing record
      declarations = await sql`
        UPDATE barrister_legal_declarations
        SET 
          bsb_authorisation_confirmed = ${bsbAuthorisationConfirmed},
          bmif_insurance_confirmed = ${bmifInsuranceConfirmed},
          public_access_compliance_confirmed = ${publicAccessComplianceConfirmed},
          advoqat_terms_accepted = ${advoqatTermsAccepted},
          privacy_consent_confirmed = ${privacyConsentConfirmed},
          digital_signature = ${digitalSignature},
          signature_date = NOW(),
          updated_at = NOW()
        WHERE user_id = ${dbUserId}
        RETURNING *
      `;
    } else {
      // Insert new record
      declarations = await sql`
        INSERT INTO barrister_legal_declarations (
          user_id, bsb_authorisation_confirmed, bmif_insurance_confirmed,
          public_access_compliance_confirmed, advoqat_terms_accepted,
          privacy_consent_confirmed, digital_signature, signature_date
        )
        VALUES (
          ${dbUserId}, ${bsbAuthorisationConfirmed}, ${bmifInsuranceConfirmed},
          ${publicAccessComplianceConfirmed}, ${advoqatTermsAccepted},
          ${privacyConsentConfirmed}, ${digitalSignature}, NOW()
        )
        RETURNING *
      `;
    }

    // Update user status to PENDING_VERIFICATION
    await sql`
      UPDATE "user"
      SET 
        profile_status = 'PENDING_VERIFICATION',
        onboarding_stage = 'pending_verification',
        updated_at = NOW()
      WHERE id = ${dbUserId}
    `;

    // Create notification for admin
    try {
      const admins = await sql`
        SELECT id, supabase_id FROM "user" WHERE role = 'admin'
      `;

      if (admins.length > 0) {
        for (const admin of admins) {
          await createNotification(
            admin.supabase_id,
            'barrister_application_complete',
            `New barrister application ready for verification (User ID: ${dbUserId})`,
            { barristerUserId: dbUserId, stage: 'pending_verification' }
          );
        }
      }
    } catch (notificationError) {
      logger.error('Error creating admin notification:', notificationError);
      // Don't fail the request if notification fails
    }

    logger.log('Legal declarations submitted:', {
      userId: dbUserId,
      stage: 'pending_verification'
    });

    res.status(200).json({
      success: true,
      message: 'Legal declarations submitted successfully. Your application is now pending verification.',
      data: {
        declarations: declarations[0],
        onboardingStage: 'pending_verification',
        profileStatus: 'PENDING_VERIFICATION'
      }
    });
  } catch (error) {
    logger.error('Error submitting legal declarations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit legal declarations'
    });
  }
}

export async function getBarristerByUserId(req, res) {
  try {
    const { userId } = req.params;

    const users = await sql`
      SELECT id, supabase_id, email, name, role, profile_status, onboarding_stage
      FROM "user"
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userRecord = users[0];

    const barristers = await sql`
      SELECT *
      FROM barrister
      WHERE user_id = ${userRecord.id}
      LIMIT 1
    `;

    const responseData = {
      ...(barristers[0] || {}),
      user_id: userRecord.id,
      user_email: userRecord.email,
      user_name: userRecord.name,
      user_role: userRecord.role,
      profile_status: userRecord.profile_status,
      onboarding_stage: userRecord.onboarding_stage
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error fetching barrister:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch barrister information'
    });
  }
}

// ==================== DASHBOARD HOMEPAGE ====================

/**
 * Get barrister dashboard overview
 * GET /api/barrister/dashboard
 */
export async function getBarristerDashboard(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get user from database
    const user = await sql`
      SELECT id, supabase_id, name, email, role, profile_status, onboarding_stage
      FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Calculate profile completion percentage
    const profileData = await sql`
      SELECT 
        (CASE WHEN bp.full_name IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bp.bio IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bp.areas_of_practice IS NOT NULL AND array_length(bp.areas_of_practice, 1) > 0 THEN 1 ELSE 0 END +
         CASE WHEN bp.pricing_model IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bp.key_stages_timescales IS NOT NULL THEN 1 ELSE 0 END) * 20 as completion
      FROM "user" u
      LEFT JOIN barrister_profiles bp ON u.id = bp.user_id
      WHERE u.id = ${dbUserId}
    `;

    const profileCompletion = profileData[0]?.completion || 0;

    // Get new enquiries count
    const newEnquiries = await sql`
      SELECT COUNT(*) as count
      FROM barrister_enquiries
      WHERE barrister_id = ${dbUserId} AND status = 'pending'
    `;

    // Get expiring certificates (within 30 days)
    const expiringCerts = await sql`
      SELECT 
        document_type,
        document_name,
        expiry_date,
        (expiry_date - CURRENT_DATE) as days_until_expiry
      FROM barrister_compliance
      WHERE user_id = ${dbUserId}
        AND expiry_date IS NOT NULL
        AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND expiry_date > CURRENT_DATE
        AND status = 'approved'
      ORDER BY expiry_date ASC
    `;

    // Get recent notifications
    const notifications = await sql`
      SELECT id, type, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = ${dbUserId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    res.json({
      success: true,
      data: {
        profileCompletion: Math.min(profileCompletion, 100),
        newEnquiriesCount: parseInt(newEnquiries[0]?.count || 0),
        expiringCertificates: expiringCerts,
        notifications: notifications,
        profileStatus: user[0].profile_status,
        onboardingStage: user[0].onboarding_stage
      }
    });
  } catch (error) {
    logger.error('Error fetching barrister dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
}

// ==================== CLIENT MANAGEMENT (ENQUIRIES) ====================

/**
 * Get all enquiries for a barrister
 * GET /api/barrister/enquiries
 */
export async function getBarristerEnquiries(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const enquiries = await sql`
      SELECT 
        be.*,
        u.name as client_name,
        u.email as client_email,
        c.title as case_title
      FROM barrister_enquiries be
      JOIN "user" u ON be.client_id = u.id
      LEFT JOIN "case" c ON be.case_id = c.id
      WHERE be.barrister_id = ${dbUserId}
      ORDER BY be.created_at DESC
    `;

    res.json({
      success: true,
      data: enquiries
    });
  } catch (error) {
    logger.error('Error fetching enquiries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enquiries'
    });
  }
}

/**
 * Get single enquiry details
 * GET /api/barrister/enquiries/:id
 */
export async function getEnquiryById(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const enquiry = await sql`
      SELECT 
        be.*,
        u.name as client_name,
        u.email as client_email,
        u.phone as client_phone,
        c.title as case_title,
        c.description as case_description
      FROM barrister_enquiries be
      JOIN "user" u ON be.client_id = u.id
      LEFT JOIN "case" c ON be.case_id = c.id
      WHERE be.id = ${parseInt(id)} AND be.barrister_id = ${dbUserId}
    `;

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      data: enquiry[0]
    });
  } catch (error) {
    logger.error('Error fetching enquiry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enquiry'
    });
  }
}

/**
 * Accept an enquiry
 * POST /api/barrister/enquiries/:id/accept
 */
export async function acceptEnquiry(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Get enquiry
    const enquiry = await sql`
      SELECT * FROM barrister_enquiries
      WHERE id = ${parseInt(id)} AND barrister_id = ${dbUserId}
    `;

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    if (enquiry[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Enquiry is not in pending status'
      });
    }

    // Update enquiry status
    const updated = await sql`
      UPDATE barrister_enquiries
      SET 
        status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Auto-generate Client Care Letter draft
    const careLetter = await sql`
      INSERT INTO client_care_letters (
        enquiry_id, barrister_id, client_id, case_id, letter_content, status
      )
      VALUES (
        ${parseInt(id)},
        ${dbUserId},
        ${enquiry[0].client_id},
        ${enquiry[0].case_id || null},
        ${'Client Care Letter draft - to be completed'},
        'draft'
      )
      RETURNING *
    `;

    // Get client supabase_id for notification
    const client = await sql`
      SELECT supabase_id FROM "user" WHERE id = ${enquiry[0].client_id}
    `;
    
    if (client.length > 0 && client[0].supabase_id) {
      await createNotification(
        client[0].supabase_id,
        'enquiry_accepted',
        'Enquiry Accepted',
        `Your enquiry has been accepted by the barrister.`,
        { enquiry_id: parseInt(id), care_letter_id: careLetter[0].id }
      );
    }

    res.json({
      success: true,
      message: 'Enquiry accepted and Client Care Letter draft created',
      data: {
        enquiry: updated[0],
        careLetter: careLetter[0]
      }
    });
  } catch (error) {
    logger.error('Error accepting enquiry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept enquiry'
    });
  }
}

/**
 * Decline an enquiry
 * POST /api/barrister/enquiries/:id/decline
 */
export async function declineEnquiry(req, res) {
  try {
    const { id } = req.params;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Decline reason is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const enquiry = await sql`
      SELECT * FROM barrister_enquiries
      WHERE id = ${parseInt(id)} AND barrister_id = ${dbUserId}
    `;

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    if (enquiry[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Enquiry is not in pending status'
      });
    }

    const updated = await sql`
      UPDATE barrister_enquiries
      SET 
        status = 'declined',
        decline_reason = ${reason},
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Get client supabase_id for notification
    const client = await sql`
      SELECT supabase_id FROM "user" WHERE id = ${enquiry[0].client_id}
    `;
    
    if (client.length > 0 && client[0].supabase_id) {
      await createNotification(
        client[0].supabase_id,
        'enquiry_declined',
        'Enquiry Declined',
        `Your enquiry has been declined. Reason: ${reason}`,
        { enquiry_id: parseInt(id) }
      );
    }

    res.json({
      success: true,
      message: 'Enquiry declined',
      data: updated[0]
    });
  } catch (error) {
    logger.error('Error declining enquiry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decline enquiry'
    });
  }
}

/**
 * Request more info for an enquiry
 * POST /api/barrister/enquiries/:id/request-info
 */
export async function requestEnquiryInfo(req, res) {
  try {
    const { id } = req.params;
    const { userId, requestedInfo } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!requestedInfo || requestedInfo.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Requested information is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const enquiry = await sql`
      SELECT * FROM barrister_enquiries
      WHERE id = ${parseInt(id)} AND barrister_id = ${dbUserId}
    `;

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    const updated = await sql`
      UPDATE barrister_enquiries
      SET 
        status = 'info_requested',
        requested_info = ${requestedInfo},
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Get client supabase_id for notification
    const client = await sql`
      SELECT supabase_id FROM "user" WHERE id = ${enquiry[0].client_id}
    `;
    
    if (client.length > 0 && client[0].supabase_id) {
      await createNotification(
        client[0].supabase_id,
        'enquiry_info_requested',
        'Additional Information Requested',
        `The barrister has requested additional information: ${requestedInfo}`,
        { enquiry_id: parseInt(id) }
      );
    }

    res.json({
      success: true,
      message: 'Information request sent to client',
      data: updated[0]
    });
  } catch (error) {
    logger.error('Error requesting enquiry info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request information'
    });
  }
}

// ==================== CLIENT CARE LETTER ====================

/**
 * Create or update Client Care Letter
 * POST /api/client-care/create
 */
export async function createClientCareLetter(req, res) {
  try {
    const { userId, enquiryId, letterContent } = req.body;

    if (!userId || !enquiryId || !letterContent) {
      return res.status(400).json({
        success: false,
        error: 'User ID, enquiry ID, and letter content are required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Get enquiry
    const enquiry = await sql`
      SELECT * FROM barrister_enquiries
      WHERE id = ${parseInt(enquiryId)} AND barrister_id = ${dbUserId}
    `;

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    // Check if care letter already exists
    const existing = await sql`
      SELECT * FROM client_care_letters
      WHERE enquiry_id = ${parseInt(enquiryId)}
    `;

    let careLetter;
    if (existing.length > 0) {
      // Update existing
      careLetter = await sql`
        UPDATE client_care_letters
        SET 
          letter_content = ${letterContent},
          status = 'draft',
          updated_at = NOW()
        WHERE enquiry_id = ${parseInt(enquiryId)}
        RETURNING *
      `;
    } else {
      // Create new
      careLetter = await sql`
        INSERT INTO client_care_letters (
          enquiry_id, barrister_id, client_id, case_id, letter_content, status
        )
        VALUES (
          ${parseInt(enquiryId)},
          ${dbUserId},
          ${enquiry[0].client_id},
          ${enquiry[0].case_id || null},
          ${letterContent},
          'draft'
        )
        RETURNING *
      `;
    }

    res.json({
      success: true,
      message: 'Client Care Letter saved',
      data: careLetter[0]
    });
  } catch (error) {
    logger.error('Error creating client care letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client care letter'
    });
  }
}

/**
 * Send Client Care Letter for signature
 * POST /api/client-care/send
 */
export async function sendClientCareLetter(req, res) {
  try {
    const { userId, careLetterId } = req.body;

    if (!userId || !careLetterId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and care letter ID are required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const careLetter = await sql`
      SELECT * FROM client_care_letters
      WHERE id = ${parseInt(careLetterId)} AND barrister_id = ${dbUserId}
    `;

    if (careLetter.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client Care Letter not found'
      });
    }

    // Update status to sent
    const updated = await sql`
      UPDATE client_care_letters
      SET 
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW()
      WHERE id = ${parseInt(careLetterId)}
      RETURNING *
    `;

    // Get client supabase_id for notification
    const client = await sql`
      SELECT supabase_id FROM "user" WHERE id = ${careLetter[0].client_id}
    `;
    
    if (client.length > 0 && client[0].supabase_id) {
      await createNotification(
        client[0].supabase_id,
        'care_letter_sent',
        'Client Care Letter Sent',
        'A Client Care Letter has been sent for your review and signature.',
        { care_letter_id: parseInt(careLetterId) }
      );
    }

    res.json({
      success: true,
      message: 'Client Care Letter sent successfully',
      data: updated[0]
    });
  } catch (error) {
    logger.error('Error sending client care letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send client care letter'
    });
  }
}

// ==================== PROFILE MANAGEMENT ====================

/**
 * Get barrister profile
 * GET /api/barrister/profile
 */
export async function getBarristerProfile(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const profile = await sql`
      SELECT * FROM barrister_profiles
      WHERE user_id = ${dbUserId}
    `;

    if (profile.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'Profile not yet created'
      });
    }

    res.json({
      success: true,
      data: profile[0]
    });
  } catch (error) {
    logger.error('Error fetching barrister profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
}

/**
 * Update barrister profile
 * POST /api/barrister/profile/update
 */
export async function updateBarristerProfile(req, res) {
  try {
    const { userId, ...profileData } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Check if profile exists
    const existing = await sql`
      SELECT id FROM barrister_profiles WHERE user_id = ${dbUserId}
    `;

    let profile;
    if (existing.length > 0) {
      // Update existing profile
      const areasArray = profileData.areasOfPractice 
        ? (Array.isArray(profileData.areasOfPractice) ? profileData.areasOfPractice : [profileData.areasOfPractice])
        : null;

      profile = await sql`
        UPDATE barrister_profiles
        SET 
          full_name = COALESCE(${profileData.fullName || null}, full_name),
          bio = COALESCE(${profileData.bio || null}, bio),
          areas_of_practice = COALESCE(${areasArray || null}, areas_of_practice),
          pricing_model = COALESCE(${profileData.pricingModel || null}, pricing_model),
          hourly_rate = COALESCE(${profileData.hourlyRate !== undefined ? profileData.hourlyRate : null}, hourly_rate),
          key_stages_timescales = COALESCE(${profileData.keyStagesTimescales || null}, key_stages_timescales),
          updated_at = NOW()
        WHERE user_id = ${dbUserId}
        RETURNING *
      `;
    } else {
      // Create new profile - simplified for now
      profile = await sql`
        INSERT INTO barrister_profiles (
          user_id, full_name, bio, areas_of_practice, pricing_model, hourly_rate, key_stages_timescales
        )
        VALUES (
          ${dbUserId},
          ${profileData.fullName || null},
          ${profileData.bio || null},
          ${Array.isArray(profileData.areasOfPractice) ? profileData.areasOfPractice : (profileData.areasOfPractice ? [profileData.areasOfPractice] : [])},
          ${profileData.pricingModel || null},
          ${profileData.hourlyRate || null},
          ${profileData.keyStagesTimescales || null}
        )
        RETURNING *
      `;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile[0]
    });
  } catch (error) {
    logger.error('Error updating barrister profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
}

// ==================== COMPLIANCE ====================

/**
 * Get barrister compliance documents
 * GET /api/barrister/compliance
 */
export async function getBarristerCompliance(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const compliance = await sql`
      SELECT * FROM barrister_compliance
      WHERE user_id = ${dbUserId}
      ORDER BY created_at DESC
    `;

    res.json({
      success: true,
      data: compliance
    });
  } catch (error) {
    logger.error('Error fetching compliance documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance documents'
    });
  }
}

/**
 * Upload compliance document
 * POST /api/barrister/compliance/upload
 */
export async function uploadComplianceDocument(req, res) {
  try {
    const { userId, documentType, documentName, expiryDate } = req.body;

    if (!userId || !documentType || !documentName) {
      return res.status(400).json({
        success: false,
        error: 'User ID, document type, and document name are required'
      });
    }

    if (!req.files || !req.files.document || req.files.document.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document file is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Upload file
    const file = req.files.document[0];
    const uploadResult = await uploadBarristerDocument(file, dbUserId, documentType);

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to upload document'
      });
    }

    // Save to database
    const compliance = await sql`
      INSERT INTO barrister_compliance (
        user_id, document_type, document_name, file_url, expiry_date, status
      )
      VALUES (
        ${dbUserId},
        ${documentType},
        ${documentName},
        ${uploadResult.url},
        ${expiryDate || null},
        'pending'
      )
      RETURNING *
    `;

    res.json({
      success: true,
      message: 'Compliance document uploaded successfully',
      data: compliance[0]
    });
  } catch (error) {
    logger.error('Error uploading compliance document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload compliance document'
    });
  }
}

// ==================== MESSAGES ====================

/**
 * Get messages for a barrister
 * GET /api/messages/:clientId
 */
export async function getMessages(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;
    const dbClientId = parseInt(clientId);

    const messages = await sql`
      SELECT 
        m.*,
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM messages m
      JOIN "user" sender ON m.sender_id = sender.id
      JOIN "user" receiver ON m.receiver_id = receiver.id
      WHERE (m.sender_id = ${dbUserId} AND m.receiver_id = ${dbClientId})
         OR (m.sender_id = ${dbClientId} AND m.receiver_id = ${dbUserId})
      ORDER BY m.created_at ASC
    `;

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
}

/**
 * Send a message
 * POST /api/messages/send
 */
export async function sendMessage(req, res) {
  try {
    const { userId, receiverId, subject, content, enquiryId, caseId } = req.body;

    if (!userId || !receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: 'User ID, receiver ID, and content are required'
      });
    }

    const sender = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (sender.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sender not found'
      });
    }

    const dbSenderId = sender[0].id;
    const dbReceiverId = parseInt(receiverId);

    const message = await sql`
      INSERT INTO messages (
        sender_id, receiver_id, subject, content, enquiry_id, case_id
      )
      VALUES (
        ${dbSenderId},
        ${dbReceiverId},
        ${subject || null},
        ${content},
        ${enquiryId ? parseInt(enquiryId) : null},
        ${caseId ? parseInt(caseId) : null}
      )
      RETURNING *
    `;

    // Get receiver supabase_id for notification
    const receiver = await sql`
      SELECT supabase_id FROM "user" WHERE id = ${dbReceiverId}
    `;
    
    if (receiver.length > 0 && receiver[0].supabase_id) {
      await createNotification(
        receiver[0].supabase_id,
        'new_message',
        'New Message',
        subject || 'You have a new message',
        { message_id: message[0].id }
      );
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: message[0]
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
}

// ==================== FINANCE/BILLING ====================

/**
 * Get billing information
 * GET /api/billing
 */
export async function getBilling(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    const subscription = await sql`
      SELECT * FROM barrister_subscription
      WHERE user_id = ${dbUserId}
    `;

    res.json({
      success: true,
      data: {
        subscription: subscription[0] || null,
        invoices: [] // TODO: Implement invoice fetching
      }
    });
  } catch (error) {
    logger.error('Error fetching billing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information'
    });
  }
}

// ==================== RESOURCES ====================

/**
 * Get resources list
 * GET /api/resources/list
 */
export async function getResources(req, res) {
  try {
    const { category } = req.query;

    let resources;
    if (category) {
      resources = await sql`
        SELECT * FROM resources
        WHERE category = ${category} AND is_active = true
        ORDER BY created_at DESC
      `;
    } else {
      resources = await sql`
        SELECT * FROM resources
        WHERE is_active = true
        ORDER BY category, created_at DESC
      `;
    }

    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    logger.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources'
    });
  }
}

// ==================== ANALYTICS ====================

/**
 * Get barrister analytics
 * GET /api/barrister/analytics
 */
export async function getBarristerAnalytics(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const user = await sql`
      SELECT id FROM "user" 
      WHERE supabase_id = ${userId} OR id = ${parseInt(userId) || 0}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const dbUserId = user[0].id;

    // Get enquiry stats
    const enquiryStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        AVG(response_time) as avg_response_time
      FROM barrister_enquiries
      WHERE barrister_id = ${dbUserId}
    `;

    // Get cases by type
    const casesByType = await sql`
      SELECT 
        enquiry_type,
        COUNT(*) as count
      FROM barrister_enquiries
      WHERE barrister_id = ${dbUserId} AND status = 'accepted'
      GROUP BY enquiry_type
    `;

    res.json({
      success: true,
      data: {
        enquiries: {
          accepted: parseInt(enquiryStats[0]?.accepted || 0),
          declined: parseInt(enquiryStats[0]?.declined || 0),
          pending: parseInt(enquiryStats[0]?.pending || 0),
          avgResponseTime: parseFloat(enquiryStats[0]?.avg_response_time || 0)
        },
        casesByType: casesByType,
        responseTimes: {
          avgHours: parseFloat(enquiryStats[0]?.avg_response_time || 0)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
}

