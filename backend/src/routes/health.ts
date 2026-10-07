import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  // readyState é um número (0..3); STATES traduz para "disconnected", "connected" etc.
  const mongo = mongoose.STATES[mongoose.connection.readyState];
  res.json({ status: 'ok', mongo });
});
