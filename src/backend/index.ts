import express, { type Express, type Request, type Response } from 'express';
import authRouter from './auth/auth.js';
import { spotifyRouter } from './spotify/getCurrent.js';
import './spotify/getTop.js';

const app: Express = express();

if (process.env.ENABLE_SPOTIFY_LOGIN === 'true') {
  app.use(authRouter);
}

app.use('/api', spotifyRouter);

app.listen(3000);