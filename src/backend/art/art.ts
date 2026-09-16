import { pool } from "../db.js";
import { signuploadform } from "../auth/cloudinary_auth.js";
import { Router, type Response, type Request, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

export const artRouter = Router()


function requireSecret(req: Request, res: Response, next: NextFunction) {
    const expected = process.env.ART_SECRET;
    if (!expected) { return res.status(500).send('ART_SECRET not configured'); }

    const given = req.get('x-art-secret');
    if (typeof given !== 'string') { return res.sendStatus(401); }

    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { return res.sendStatus(401); }

    return next();
}


artRouter.get('/', async (req: Request, res: Response) => {
    const { rows } = await pool.query(
        `SELECT id, public_id AS "publicId", url, title, year, medium,
                width, height, metadata, created_at AS "createdAt"
         FROM art
         ORDER BY created_at DESC`
    );
    // camelCase, and wrapped in { art } -- the shape frontend/src/studio/art.ts expects
    return res.json({ art: rows });
});

artRouter.get('/signature', requireSecret, (req: Request, res: Response) => {
    return res.json(signuploadform());
});

artRouter.post('/', requireSecret, async (req: Request, res: Response) => {
    const { publicId, url,
        width, height, title, year, medium, metadata } = req.body ?? {};

    if (typeof publicId !== 'string' || typeof url !== 'string') {
        return res.status(400).send('publicId and url are required');
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return res.status(400).send('width and height must be integers');
    }
    if (year !== undefined && year !== null && !Number.isInteger(year)) {
        return res.status(400).send('year must be an integer');
    }

    
    const { rows } = await pool.query(
        `INSERT INTO art (public_id, url, width, height, title, year, medium, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (public_id) DO UPDATE SET
            url = EXCLUDED.url,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            title = EXCLUDED.title,
            year = EXCLUDED.year,
            medium = EXCLUDED.medium,
            metadata = EXCLUDED.metadata
         RETURNING id, public_id AS "publicId", url, title, year, medium,
                   width, height, metadata, created_at AS "createdAt"`,
        [publicId, url, width, height,
            title ?? null, year ?? null, medium ?? null, metadata ?? {}]
    );

    return res.status(201).json(rows[0]);
});

export default artRouter;
