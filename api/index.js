// Vercel's way in to the backend: vercel.json rewrites every /api/... request here, and Express
// still sees the original path. Plain JS on purpose — Vercel compiles a .ts function with the
// project's own typescript package, and TypeScript 7 has no API for it to call — so the build
// runs tsc first (vercel.json's buildCommand) and this imports what that compiled.
import app from '../dist/backend/app.js';

export default app;
