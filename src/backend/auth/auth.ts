const client_id = process.env.CLIENT_ID
const redirect_uri = process.env.REDIRECT_URI
const client_secret = process.env.CLIENT_SECRET


import {Router, type Request, type Response} from 'express'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'

const authRouter =Router() 

authRouter.get('/login', (req:Request,res:Response)=>{
    const state = randomBytes(16).toString('hex');
    const scope = 'user-read-currently-playing user-read-private user-top-read'


    const params = new URLSearchParams({
    response_type: 'code',
    client_id: client_id!,
    scope: scope,
    redirect_uri: redirect_uri!,
    state: state,
    })

    res.redirect('https://accounts.spotify.com/authorize?' +
        params.toString()
    );
})

import querystring from 'node:querystring'

authRouter.get('/callback', async (req:Request, res: Response) => {
    const code = req.query.code || null;
    const state = req.query.state || null;

    if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
    } else {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret)
            .toString('base64'),
        },
        body: new URLSearchParams({
            code: code as string,
            redirect_uri: redirect_uri!,
            grant_type: 'authorization_code',
        }),
    });

    const data = await response.json();

    if (!data.refresh_token) {
      res.status(400).send(data);
      return;
    }

    appendFileSync('.env', `\nSPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);

    res.redirect('http://localhost:5173');
  }
});

export async function get_accessToken(refreshToken:string) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret)
            .toString('base64'),
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });
    const data = await response.json()
    return data.access_token;
}

export default authRouter;