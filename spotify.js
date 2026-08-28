module.exports = async function handler(req, res) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID || '3af5dfbf2bec4a40a0b0e6b3a0beaa9c';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientSecret) return res.status(500).json({error:'SPOTIFY_CLIENT_SECRET belum diset di Vercel.'});

    const p = req.query || {};
    const action = p.action || 'search';
    const q = p.q || 'popular music';
    const limit = String(Math.min(Math.max(parseInt(p.limit || '12',10)||12,1),50));

    const tokenR = await fetch('https://accounts.spotify.com/api/token', {
      method:'POST',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded',
        'Authorization':'Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64')
      },
      body:new URLSearchParams({grant_type:'client_credentials'})
    });
    const tokenText = await tokenR.text();
    if (!tokenR.ok) return res.status(tokenR.status).json({error:'Spotify token gagal',details:tokenText.slice(0,500)});
    const token = JSON.parse(tokenText).access_token;

    let url;
    if (action === 'artist-top-tracks') {
      url = 'https://api.spotify.com/v1/artists/'+encodeURIComponent(p.id)+'/top-tracks?market=ID';
    } else {
      const types = p.type || 'track';
      url = 'https://api.spotify.com/v1/search?'+new URLSearchParams({q,type:types,limit,market:'ID'});
    }

    const r = await fetch(url,{headers:{Authorization:'Bearer '+token}});
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({error:'Spotify API gagal',details:text.slice(0,500)});
    let data;
    try { data=JSON.parse(text); } catch { return res.status(502).json({error:'Spotify mengembalikan data bukan JSON',details:text.slice(0,200)}); }
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({error:e.message || 'Server error'});
  }
};
