import express, { type Express, type Request, type Response } from 'express';
import authRouter from './auth/auth.js';
import { spotifyRouter } from './spotify/getCurrent.js';
import './spotify/getTop.js';
import { artRouter } from './art/art.js';

const app: Express = express();

app.use(express.json());

if (process.env.ENABLE_SPOTIFY_LOGIN === 'true') {
  app.use(authRouter);
}

app.use('/api', spotifyRouter);
// not behind a flag: the gallery has to work in production
app.use('/api/art', artRouter);

app.listen(3000);

