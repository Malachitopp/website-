const client_id = process.env.CLIENT_ID
const redirect_uri = process.env.REDIRECT_URI
const client_secret = process.env.CLIENT_SECRET


import {Router, type Request, type Response} from 'express'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'

const authRouter =Router() 
const pendingStates = new Set<string>() 

authRouter.get('/login', (req:Request,res:Response)=>{
    const state = randomBytes(16).toString('hex');
    const scope = 'user-read-currently-playing user-read-private user-top-read'

    pendingStates.add(state)
    setTimeout(()=> pendingStates.delete(state), 10 * 60_000)

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



authRouter.get('/callback', async (req:Request, res: Response) => {
    const code = req.query.code;
    const state = req.query.state;

    if (typeof state !== 'string' || !pendingStates.has(state)) {
        res.status(400).send('state mismatch')
        return 
    } 
    pendingStates.delete(state);
    if (typeof code !== 'string'){ 
        res.status(400).send('no code')
        return 
    }
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret)
            .toString('base64'),
        },
        body: new URLSearchParams({
            code: code,
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
);

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
    if (!response.ok) {
        throw new Error(`failed to refresh access token: ${response.status} ${await response.text()}`)
    }
    const data = await response.json()

    return data.access_token;
}

export default authRouter;