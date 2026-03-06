import stripe from '../config/stripe.js';
import { sql } from '../config/db.js';
import { createNotification } from './notificationController.js';
import dotenv from 'dotenv';

dotenv.config();

// Create a Stripe checkout session for consultation booking
export const createCheckoutSession = async (req, res) => {
  try {
    const { consultationId, lawyerName, datetime, method, fee, userId, customerId } = req.body;
    
    if (!consultationId || !fee) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: consultationId and fee are required' 
      });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format the price for display (assumes fee is in the smallest currency unit, e.g., cents)
    const formattedPrice = (fee / 100).toFixed(2);
    const consultationDate = new Date(datetime).toLocaleDateString();
    const consultationTime = new Date(datetime).toLocaleTimeString();

    // Create a payment intent first to get the client secret for the modal
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fee,
      currency: 'usd',
      metadata: {
        consultationId,
        userId: user[0].id.toString(), // Use database user ID
        lawyerName,
        datetime,
        method,
      },
    });

    // Create the checkout session with the consultation details
    // We still create this for backend records and webhook support
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd', // Change this to your preferred currency
            product_data: {
              name: `Legal Consultation with ${lawyerName}`,
              description: `${method} consultation on ${consultationDate} at ${consultationTime}`,
            },
            unit_amount: fee, // Amount in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        consultationId,
        userId: user[0].id.toString(), // Use database user ID
        lawyerName,
        datetime,
        method,
        paymentIntentId: paymentIntent.id,
      },
      mode: 'payment',
      // Do not add payment_intent parameter as it's not supported by Stripe API
      // The checkout session will create its own payment intent
      customer: customerId || undefined, // Use existing customer if provided
      success_url: `${process.env.FRONTEND_URL}/dashboard/consultations?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/consultations?payment=cancelled`,
    });

    // Return the session ID to the client
    res.json({ 
      success: true,
      sessionId: session.id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      url: session.url // Still include the URL as fallback
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create checkout session', 
      error: error.message 
    });
  }
};

// Create checkout session for document unlock (paywall)
export const createDocumentCheckoutSession = async (req, res) => {
  try {
    const { documentId, userId, amount, successUrl, cancelUrl } = req.body;
    if (!documentId || !userId || amount == null) {
      return res.status(400).json({
        success: false,
        message: 'documentId, userId, and amount are required',
      });
    }
    const numericAmount = Math.round(Number(amount));
    if (numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const userRows = await sql`SELECT id FROM "user" WHERE supabase_id = ${userId}`;
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const dbUserId = userRows[0].id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Document unlock — editable Word download',
            description: 'One-time download including editable Word document and regenerations',
          },
          unit_amount: numericAmount,
        },
        quantity: 1,
      }],
      metadata: {
        documentId: String(documentId),
        userId: String(dbUserId),
      },
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/dashboard/documents?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/dashboard/documents?payment=cancelled`,
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating document checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message,
    });
  }
};

// Verify a completed payment session
export const verifyPaymentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session ID is required' 
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Return the session details
    res.status(200).json({
      success: true,
      paid: session.payment_status === 'paid',
      metadata: session.metadata,
    });
  } catch (error) {
    console.error('Error verifying payment session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify payment session', 
      error: error.message 
    });
  }
};

/**
 * Confirm document payment from success redirect (when webhook may not have run, e.g. local dev).
 * Retrieves session from Stripe, marks document paid, generates Word file, and sets generated_file_path.
 */
export const confirmDocumentPayment = async (req, res) => {
  try {
    const { sessionId, documentId } = req.body;
    if (!sessionId || !documentId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and documentId are required',
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({
        success: false,
        message: 'Payment not completed',
      });
    }
    const metaDocId = session.metadata?.documentId;
    if (String(metaDocId) !== String(documentId)) {
      return res.status(400).json({
        success: false,
        message: 'Document ID does not match session',
      });
    }

    const docId = parseInt(String(documentId), 10);
    if (isNaN(docId)) {
      return res.status(400).json({ success: false, message: 'Invalid documentId' });
    }

    const { updateDocumentPayment } = await import('./documentController.js');
    const { renderWordDocument, saveDocumentToStorage } = await import('../services/documentRenderer.js');

    await updateDocumentPayment(docId, {
      paymentStatus: 'paid',
      paymentId: session.id,
      paymentAmount: session.amount_total,
    });

    const [doc] = await sql`
      SELECT id, user_id, generated_document, jurisdiction, risk_level, version_id
      FROM documents WHERE id = ${docId}
    `;
    if (doc && doc.generated_document) {
      try {
        const versionId = doc.version_id || `v1_${Date.now()}`;
        const buffer = await renderWordDocument({
          content: doc.generated_document,
          documentId: doc.id,
          versionId,
          jurisdiction: doc.jurisdiction || 'England & Wales',
          riskLevel: doc.risk_level || 'Simple',
        });
        const relativePath = await saveDocumentToStorage(buffer, doc.user_id, doc.id, versionId);
        await sql`
          UPDATE documents
          SET generated_file_path = ${relativePath}, version_id = ${versionId}, updated_at = NOW()
          WHERE id = ${docId}
        `;
      } catch (genErr) {
        console.error('Error generating Word document in confirmDocumentPayment:', genErr);
        return res.status(500).json({
          success: false,
          message: 'Document file could not be generated',
          error: genErr.message,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('confirmDocumentPayment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm document payment',
      error: error.message,
    });
  }
};

// Handle Stripe webhook events
export const handleStripeWebhook = async (req, res) => {
  // Get the signature sent by Stripe
  const signature = req.headers['stripe-signature'];
  
  try {
    // Verify and construct the event using raw body
    // The req.body is already a Buffer because we used express.raw middleware
    const event = stripe.webhooks.constructEvent(
      req.body, // This is now raw Buffer from express.raw middleware
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle the event based on its type
    console.log('[Stripe webhook] Event type:', event.type);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Barrister subscription (one-time payment with planId) → update barrister_subscription
        if (session.metadata?.planId && session.mode === 'payment') {
          console.log('[Stripe webhook] Barrister subscription payment detected, updating barrister_subscription', {
            planId: session.metadata.planId,
            userId: session.metadata.userId,
          });
          const { handleBarristerCheckoutCompleted } = await import('./stripeWebhookController.js');
          await handleBarristerCheckoutCompleted(session);
          console.log('[Stripe webhook] Barrister subscription updated successfully');
          return res.json({ received: true });
        }
        // Consultation or document payment
        await handleCompletedCheckout(session);
        break;
      }
        
      case 'payment_intent.payment_failed':
        // Payment failed
        await handleFailedPayment(event.data.object);
        break;
      
      // Add other event types as needed
      
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a success response
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// Handle successful checkout completion
const handleCompletedCheckout = async (session) => {
  try {
    const { consultationId, documentId, userId } = session.metadata || {};
    
    const { createPaymentRecord } = await import('./paymentHistoryController.js');
    const { calculateFreelancerPayout } = await import('../utils/commissionCalculator.js');
    
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      console.error('Invalid userId in session metadata:', userId);
      return;
    }

    const totalAmount = session.amount_total || 0;
    const isConsultation = consultationId != null;
    let paymentData = {
      userId: parsedUserId,
      consultationId: consultationId ? parseInt(consultationId, 10) : null,
      documentId: documentId ? parseInt(documentId, 10) : null,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      amount: totalAmount,
      currency: session.currency || 'gbp',
      paymentMethod: 'card',
      status: 'completed',
      serviceType: isConsultation ? 'consultation' : 'document_download',
      description: isConsultation ? 'Legal consultation payment' : 'Document download payment',
      metadata: session.metadata || {},
    };

    if (isConsultation) {
      const consultationResult = await sql`
        SELECT c.*, f.user_id as freelancer_user_id, f.name as freelancer_name, f.id as freelancer_table_id,
               u.supabase_id as client_supabase_id
        FROM consultations c
        LEFT JOIN freelancer f ON c.freelancer_id = f.id
        LEFT JOIN "user" u ON c.client_id = u.id
        WHERE c.id = ${parseInt(consultationId, 10)}
      `;
      const consultation = consultationResult[0];
      if (consultation) {
        const { platformFee, freelancerEarnings } = calculateFreelancerPayout(totalAmount);
        paymentData = {
          ...paymentData,
          platformFee,
          freelancerEarnings,
          freelancerId: consultation.freelancer_user_id,
          clientId: parsedUserId,
        };
        await sql`
          UPDATE freelancer
          SET total_earnings = total_earnings + ${freelancerEarnings}, updated_at = NOW()
          WHERE user_id = ${consultation.freelancer_user_id}
        `;
      }
    }

    await createPaymentRecord(paymentData);
    console.log('Payment record created for session:', session.id);
    
    if (consultationId) {
      const { updateConsultationPayment } = await import('./consultationController.js');
      await updateConsultationPayment(parseInt(consultationId, 10), {
        paymentStatus: 'paid',
        paymentId: session.id,
        paymentAmount: totalAmount,
      });

      const consultationResult = await sql`
        SELECT c.*, f.user_id as freelancer_user_id, f.name as freelancer_name, u.supabase_id as client_supabase_id
        FROM consultations c
        LEFT JOIN freelancer f ON c.freelancer_id = f.id
        LEFT JOIN "user" u ON c.client_id = u.id
        WHERE c.id = ${parseInt(consultationId, 10)}
      `;

      if (consultationResult.length > 0) {
        const consultation = consultationResult[0];
        await createNotification(
          consultation.freelancer_user_id,
          'payment_received',
          'Payment Received',
          `You have received a payment (after 15% platform fee) for consultation on ${new Date(consultation.scheduled_at).toLocaleDateString()}.`,
          { consultation_id: consultationId, amount: totalAmount, payment_id: session.id, scheduled_at: consultation.scheduled_at }
        );
        await createNotification(
          consultation.client_supabase_id,
          'payment_completed',
          'Payment Completed',
          `Your payment for consultation with ${consultation.freelancer_name} has been processed successfully.`,
          { consultation_id: consultationId, amount: totalAmount, payment_id: session.id, freelancer_name: consultation.freelancer_name }
        );
      }
      console.log(`Payment confirmed for consultation ${consultationId}`);
    } else if (documentId) {
      // Handle document payment: mark paid, then generate Word and store path
      const { updateDocumentPayment } = await import('./documentController.js');
      const { renderWordDocument, saveDocumentToStorage } = await import('../services/documentRenderer.js');
      const docId = parseInt(documentId, 10);
      if (isNaN(docId)) {
        console.error('Invalid documentId in webhook:', documentId);
        return;
      }
      await updateDocumentPayment(docId, {
        paymentStatus: 'paid',
        paymentId: session.id,
        paymentAmount: session.amount_total,
      });

      const [doc] = await sql`
        SELECT id, user_id, generated_document, jurisdiction, risk_level, version_id
        FROM documents WHERE id = ${docId}
      `;
      if (doc && doc.generated_document) {
        try {
          const versionId = doc.version_id || `v1_${Date.now()}`;
          const buffer = await renderWordDocument({
            content: doc.generated_document,
            documentId: doc.id,
            versionId,
            jurisdiction: doc.jurisdiction || 'England & Wales',
            riskLevel: doc.risk_level || 'Simple',
          });
          const relativePath = await saveDocumentToStorage(buffer, doc.user_id, doc.id, versionId);
          await sql`
            UPDATE documents
            SET generated_file_path = ${relativePath}, version_id = ${versionId}, updated_at = NOW()
            WHERE id = ${docId}
          `;
        } catch (genErr) {
          console.error('Error generating Word document after payment:', genErr);
        }
      }
      console.log(`Payment confirmed for document ${documentId}`);
    } else {
      console.error('No consultationId or documentId found in session metadata');
    }
  } catch (error) {
    console.error('Error handling completed checkout:', error);
  }
};

// Handle failed payment
const handleFailedPayment = async (paymentIntent) => {
  try {
    const { consultationId, documentId, userId } = paymentIntent.metadata;
    
    // Create or update payment record
    const { createPaymentRecord, updatePaymentStatus } = await import('./paymentHistoryController.js');
    
    // Validate userId
    const parsedUserId = parseInt(userId)
    if (isNaN(parsedUserId)) {
      console.error('Invalid userId in payment intent metadata:', userId)
      return
    }

    const paymentData = {
      userId: parsedUserId,
      consultationId: consultationId ? parseInt(consultationId) : null,
      documentId: documentId ? parseInt(documentId) : null,
      stripeSessionId: null,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      paymentMethod: 'card',
      status: 'failed',
      serviceType: consultationId ? 'consultation' : 'document_download',
      description: consultationId 
        ? `Legal consultation payment (failed)` 
        : `Document download payment (failed)`,
      metadata: paymentIntent.metadata
    };
    
    await createPaymentRecord(paymentData);
    console.log('Failed payment record created for payment intent:', paymentIntent.id);
    
    if (consultationId) {
      // Handle consultation payment failure
      const { updateConsultationPayment } = await import('./consultationController.js');
      
      await updateConsultationPayment(consultationId, {
        paymentStatus: 'failed',
        paymentId: paymentIntent.id,
      });

      console.log(`Payment failed for consultation ${consultationId}`);
    } else if (documentId) {
      // Handle document payment failure
      const { updateDocumentPayment } = await import('./documentController.js');
      
      await updateDocumentPayment(documentId, {
        paymentStatus: 'failed',
        paymentId: paymentIntent.id,
      });

      console.log(`Payment failed for document ${documentId}`);
    } else {
      console.error('No consultationId or documentId found in payment intent metadata');
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
};
