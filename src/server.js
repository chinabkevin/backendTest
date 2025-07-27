import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
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
import job from './config/cron.js';

dotenv.config();

const app = express();

if(process.env.NODE_ENV === 'production'){
  job.start();
}

// Allow CORS for frontend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000", 
      "https://private-repo-sand.vercel.app",
      "https://legaliq.vercel.app",
      "https://legaliq-frontend.vercel.app",
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    // Temporary: Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use(rateLimiter);

// Create a router just for the Stripe webhook endpoint with raw body parsing
const stripeWebhookRouter = express.Router();
stripeWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // This endpoint receives the raw body before any JSON parsing
  next();
});

// Register the Stripe webhook route BEFORE the JSON body parser
app.use('/api/payments', stripeWebhookRouter);

// JSON body parser for all other routes
app.use(express.json());

const PORT = process.env.PORT || 5001;
// 


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/freelancers', freelancerRoute);
app.use('/api/cases', caseRoute);
app.use('/api/users', userRoute);
app.use('/api', consultationRoute);
app.use('/api/v1/documents', documentRoute);
app.use('/api/v1/ai', aiAssistantRoute);
app.use('/api/payments', paymentRoute);


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

