import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './shared/middlewares/errorHandler';

// Route modules
import dropRouter from './modules/drops/drop.routes';
import reservationRouter from './modules/reservations/reservation.routes';
import userRouter from './modules/users/user.routes';

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/drops', dropRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/users', userRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' });
});

// ─── Central Error Handler (MUST be last) ────────────────────────────────────
app.use(errorHandler);

export default app;