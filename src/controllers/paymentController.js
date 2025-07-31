import stripe from '../config/stripe.js';
import { sql } from '../config/db.js';
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
    switch (event.type) {
      case 'checkout.session.completed':
        // Payment was successful
        await handleCompletedCheckout(event.data.object);
        break;
        
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
    const { consultationId, documentId, userId } = session.metadata;
    
    // Create payment record
    const { createPaymentRecord } = await import('./paymentHistoryController.js');
    
    // Validate userId
    const parsedUserId = parseInt(userId)
    if (isNaN(parsedUserId)) {
      console.error('Invalid userId in session metadata:', userId)
      return
    }

    const paymentData = {
      userId: parsedUserId,
      consultationId: consultationId ? parseInt(consultationId) : null,
      documentId: documentId ? parseInt(documentId) : null,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      paymentMethod: 'card',
      status: 'completed',
      serviceType: consultationId ? 'consultation' : 'document_download',
      description: consultationId 
        ? `Legal consultation payment` 
        : `Document download payment`,
      metadata: session.metadata
    };
    
    await createPaymentRecord(paymentData);
    console.log('Payment record created for session:', session.id);
    
    if (consultationId) {
      // Handle consultation payment
      const { updateConsultationPayment } = await import('./consultationController.js');
      
      await updateConsultationPayment(consultationId, {
        paymentStatus: 'paid',
        paymentId: session.id,
        paymentAmount: session.amount_total,
      });

      console.log(`Payment confirmed for consultation ${consultationId}`);
    } else if (documentId) {
      // Handle document payment
      const { updateDocumentPayment } = await import('./documentController.js');
      
      await updateDocumentPayment(documentId, {
        paymentStatus: 'paid',
        paymentId: session.id,
        paymentAmount: session.amount_total,
      });

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
