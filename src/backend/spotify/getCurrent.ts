import { Router, type Request, type Response } from 'express';
import { get_accessToken } from '../auth/auth.js';

const spotifyRouter = Router()

spotifyRouter.get('/now-playing', async (req: Request, res: Response) => {
    const accessToken = await get_accessToken(process.env.SPOTIFY_REFRESH_TOKEN!);

    const current = await fetch(
        'https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {'Authorization': 'Bearer ' + accessToken}
        });

    if (current.status === 204) {
        return res.json({ is_playing: false });
    }
    if (!current.ok) { return res.sendStatus(400); }

    const data = await current.json();

    res.json({
        is_playing: data.is_playing,
        track: data.item.name,
        artist: data.item.artists.map((a: any) => a.name).join(', '),
        albumArt: data.item.album.images[0]?.url,
        songUrl: data.item.external_urls.spotify,
    });
})

export default spotifyRouter;
