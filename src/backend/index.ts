import app from './app.js';

// Local only (npm start). On Vercel nothing listens: api/index.js exports the app instead.
app.listen(3000);
