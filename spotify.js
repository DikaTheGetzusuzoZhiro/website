let cachedToken = null;
let tokenExpiresAt = 0;

const CLIENT_ID = "3af5dfbf2bec4a40a0b0e6b3a0beaa9c";

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;

  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!secret) throw new Error("SPOTIFY_CLIENT_SECRET belum diset di Vercel.");

  const basic = Buffer.from(`${CLIENT_ID}:${secret}`).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error_description || "Gagal autentikasi Spotify.");

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  try {
    const { action, q, type="track", limit="20", market="ID", id } = req.query;

    if (!action) return res.status(400).json({error:"action diperlukan"});

    const token = await getToken();
    let path;

    if (action === "search") {
      const allowed = ["track","artist","album","playlist"];
      if (!allowed.includes(type)) return res.status(400).json({error:"type tidak valid"});
      path = `/v1/search?${new URLSearchParams({
        q: q || "popular",
        type,
        limit: String(Math.min(Number(limit) || 20, 50)),
        market
      })}`;
    } else if (action === "artist-top-tracks") {
      if (!id) return res.status(400).json({error:"artist id diperlukan"});
      path = `/v1/artists/${encodeURIComponent(id)}/top-tracks?market=${encodeURIComponent(market)}`;
    } else {
      return res.status(400).json({error:"action tidak didukung"});
    }

    const r = await fetch("https://api.spotify.com" + path, {
      headers: {Authorization:`Bearer ${token}`}
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({error:data?.error?.message || "Spotify API error"});
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({error:e.message || "Server error"});
  }
}
