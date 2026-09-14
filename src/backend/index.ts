import express, { type Express, type Request, type Response } from 'express';
import authRouter from './auth/auth.js';
import spotifyRouter from './spotify/getCurrent.js';

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use(authRouter);
app.use('/api', spotifyRouter);

app.listen(3000);