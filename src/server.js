import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { initDB } from './config/db.js';
import rateLimiter from './middleware/rateLimiter.js';
import freelancerRoute from './routes/freelancerRoute.js';
import caseRoute from './routes/caseRoute.js';
import userRoute from './routes/userRoute.js';
import consultationRoute from './routes/consultationRoute.js';
import documentRoute from './routes/documentRoute.js';
import aiAssistantRoute from './routes/aiAssistantRoute.js';
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use(rateLimiter);

//middleware to parse json body
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


initDB().then(() => {
    app.listen(PORT, () => {
        console.log('Server is running on port :', PORT);
      });
});

