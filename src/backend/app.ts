import express, { type Express } from 'express';
import authRouter from './auth/auth.js';
import { spotifyRouter } from './spotify/getCurrent.js';
import './spotify/getTop.js';
import { artRouter } from './art/art.js';

// The app without a port: index.ts listens on one locally, and on Vercel api/index.js hands it
// every /api request instead.
const app: Express = express();

app.use(express.json());

if (process.env.ENABLE_SPOTIFY_LOGIN === 'true') {
  app.use(authRouter);
}

app.use('/api', spotifyRouter);
// not behind a flag: the gallery has to work in production
app.use('/api/art', artRouter);

export default app;
