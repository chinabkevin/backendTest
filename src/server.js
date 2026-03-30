import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDB } from './config/db.js';
import { runMigrations } from './config/migrations/run_migrations.js';
import rateLimiter from './middleware/rateLimiter.js';
import freelancerRoute from './routes/freelancerRoute.js';
import caseRoute from './routes/caseRoute.js';
import userRoute from './routes/userRoute.js';
import consultationRoute from './routes/consultationRoute.js';
import documentRoute from './routes/documentRoute.js';
import aiAssistantRoute from './routes/aiAssistantRoute.js';
import paymentRoute from './routes/paymentRoute.js';
import { handleStripeWebhook } from './controllers/paymentController.js';
import paymentHistoryRoute from './routes/paymentHistoryRoute.js';
import profileRoute from './routes/profileRoute.js';
import notificationRoute from './routes/notificationRoute.js';
import contactRoute from './routes/contactRoute.js';
import authRoute from './routes/authRoute.js';
import barristerRoute from './routes/barristerRoute.js';
import barristerEngagementRoute from './routes/barristerEngagementRoute.js';
import clientCareRoute from './routes/clientCareRoute.js';
import messageRoute from './routes/messageRoute.js';
import engagementRoute from './routes/engagementRoute.js';
import lawyerDeclarationRoute from './routes/lawyerDeclarationRoute.js';
import adminOnboardingRoute from './routes/adminOnboardingRoute.js';
import billingRoute from './routes/billingRoute.js';
import resourceRoute from './routes/resourceRoute.js';
import stripeRoute from './routes/stripeRoute.js';
import job, { subscriptionExpiryJob } from './config/cron.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();

if (process.env.NODE_ENV === 'production') {
  job.start();
  subscriptionExpiryJob.start();
}

// Allow CORS for frontend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000", 
      "https://app.advoqat.com",
      "https://advoqat.vercel.app",
      "https://advoqat.onrender.com",
      "https://advoqat-frontend.vercel.app",
      "https://legaliq.onrender.com",
      "https://dashboard.advoqat.com",
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    // Temporary: Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      logger.log('CORS allowed origin:', origin);
      callback(null, true);
    } else {
      logger.log('CORS blocked origin:', origin);
      logger.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.use(cookieParser());

app.use(rateLimiter);

// Stripe webhook MUST use raw body - register handler here so it runs before express.json()
const stripeWebhookRouter = express.Router();
stripeWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Register the Stripe webhook routes BEFORE the JSON body parser
app.use('/api/payments', stripeWebhookRouter);
app.use('/api/stripe', stripeRoute);

// JSON body parser for all other routes
app.use(express.json());

const PORT = process.env.PORT || 5001;
// 


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Authentication routes (must be before other routes)
app.use('/', authRoute);

app.use('/api/freelancers', freelancerRoute);
app.use('/api/cases', caseRoute);
app.use('/api/users', userRoute);
app.use('/api', consultationRoute);
app.use('/api/v1/documents', documentRoute);
app.use('/api/v1/ai', aiAssistantRoute);
app.use('/api/payments', paymentRoute);
app.use('/api/payment-history', paymentHistoryRoute);
app.use('/api/profile', profileRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/contact', contactRoute);
app.use('/api/barrister/engagement', barristerEngagementRoute);
app.use('/api/barrister', barristerRoute);
app.use('/api/barristers', barristerRoute); // Legacy support
app.use('/api/client-care', clientCareRoute);
app.use('/api/messages', messageRoute);
app.use('/api/engagement', engagementRoute);
app.use('/api/lawyer', lawyerDeclarationRoute);
app.use('/api/admin', adminOnboardingRoute);
app.use('/api/billing', billingRoute);
app.use('/api/resources', resourceRoute);


initDB().then(async () => {
    // Run database migrations
    try {
        console.log('Running database migrations...');
        const migrationResult = await runMigrations();
        console.log('Migrations complete:', migrationResult);
    } catch (error) {
        console.error('Error running migrations:', error);
        // Continue starting server despite migration errors
    }
    
    app.listen(PORT, () => {
        console.log('Server is running on port :', PORT);
    });
});

