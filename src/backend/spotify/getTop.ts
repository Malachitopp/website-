import { Router, type Request, type Response } from 'express';
import { get_accessToken } from '../auth/auth.js';
import { spotifyRouter } from './getCurrent.js';


spotifyRouter.get(`/top/:type`, async (req: Request, res: Response)=>{
    const type = req.params.type
    const timeRange = req.query.time_range ?? 'medium_term'
    const allowedRanges = ['short_term', 'medium_term', 'long_term']

    if ( type !== 'artists') {return res.status(400).send('artists only')}
    if (typeof timeRange !== 'string' || !allowedRanges.includes(timeRange)) {
        return res.status(400).send('invalid time_range')
    }

    const accessToken = await get_accessToken(process.env.SPOTIFY_REFRESH_TOKEN!)

    const response = await fetch(
        `https://api.spotify.com/v1/me/top/${type}?limit=5&time_range=${timeRange}`,
    {
        headers: {'Authorization': 'Bearer ' + accessToken}
    });
    if (!response.ok ) {return res.sendStatus(400) }

    const data = await response.json() 
    
    const topArtists = data.items.map((artist: any) => ({
        name: artist.name,
        image: artist.images[0]?.url,
        genres: artist.genres,
        spotifyUrl: artist.external_urls.spotify,
    }));

    return res.json(topArtists);
})