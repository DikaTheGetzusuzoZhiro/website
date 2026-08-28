# TAMA MUSIC - Spotify

## Vercel
1. Upload/deploy this folder to Vercel.
2. In Vercel Project Settings > Environment Variables, add:
   `SPOTIFY_CLIENT_SECRET` = Client Secret Spotify kamu.
3. In Spotify Developer Dashboard, add your Vercel URL as Redirect URI, for example:
   `https://nama-project.vercel.app/`
4. Redeploy.

Client Secret is only used by `/api/spotify.js` and is never sent to the browser.

The catalog home/search uses Spotify Client Credentials on the server, so music covers/results can appear even before Spotify user login. User login uses PKCE for profile/library-related features.

Do not commit the real Client Secret to GitHub.
