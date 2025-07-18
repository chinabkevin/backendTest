import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { initDB } from './config/db.js';
import rateLimiter from './middleware/rateLimiter.js';
import freelancerRoute from './routes/freelancerRoute.js';
import caseRoute from './routes/caseRoute.js';
import userRoute from './routes/userRoute.js';
import job from './config/cron.js';

dotenv.config();

const app = express();

if(process.env.NODE_ENV === 'production'){
  job.start();
}

// Allow CORS for frontend
app.use(cors({
  origin: ["http://localhost:3000", process.env.CORS_ORIGIN].filter(Boolean),
  credentials: true
}));

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


initDB().then(() => {
    app.listen(PORT, () => {
        console.log('Server is running on port :', PORT);
      });
});

