const CLIENT_ID = "3af5dfbf2bec4a40a0b0e6b3a0beaa9c";
const REDIRECT_URI = window.location.origin + window.location.pathname;
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-private user-read-email user-library-read";

let accessToken = localStorage.getItem("tama_spotify_access_token");
let expiresAt = Number(localStorage.getItem("tama_spotify_expires_at") || 0);
let currentTracks = [];
let currentTrack = null;
let currentIndex = -1;

const $ = id => document.getElementById(id);

function escapeHTML(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function trackImage(t) {
  return t?.album?.images?.[0]?.url ||
         t?.album?.images?.[1]?.url ||
         "https://placehold.co/500x500/181818/ffffff?text=TAMA";
}

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const a = crypto.getRandomValues(new Uint8Array(length));
  return [...a].map(x => chars[x % chars.length]).join("");
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function loginSpotify() {
  const verifier = randomString();
  const state = randomString(32);
  const challenge = base64Url(await sha256(verifier));
  localStorage.setItem("tama_code_verifier", verifier);
  localStorage.setItem("tama_oauth_state", state);
  const p = new URLSearchParams({
    client_id: CLIENT_ID, response_type: "code",
    redirect_uri: REDIRECT_URI, state, scope: SCOPES,
    code_challenge_method: "S256", code_challenge: challenge
  });
  location.href = AUTHORIZE_URL + "?" + p;
}

async function handleCallback() {
  const p = new URLSearchParams(location.search);
  const code = p.get("code");
  if (!code) return;

  if (p.get("state") !== localStorage.getItem("tama_oauth_state")) {
    alert("Login Spotify gagal: state tidak cocok.");
    return;
  }

  const verifier = localStorage.getItem("tama_code_verifier");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      grant_type:"authorization_code", code,
      redirect_uri:REDIRECT_URI, client_id:CLIENT_ID,
      code_verifier:verifier
    })
  });
  const data = await r.json();
  if (!r.ok) {
    console.error(data);
    alert("Gagal mendapatkan token Spotify.");
    return;
  }
  saveToken(data);
  history.replaceState({}, document.title, REDIRECT_URI);
}

function saveToken(data) {
  accessToken = data.access_token;
  expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  localStorage.setItem("tama_spotify_access_token", accessToken);
  localStorage.setItem("tama_spotify_expires_at", expiresAt);
  if (data.refresh_token) localStorage.setItem("tama_spotify_refresh_token", data.refresh_token);
}

async function refreshToken() {
  const refresh = localStorage.getItem("tama_spotify_refresh_token");
  if (!refresh) return false;
  const r = await fetch(TOKEN_URL, {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      grant_type:"refresh_token", refresh_token:refresh, client_id:CLIENT_ID
    })
  });
  const data = await r.json();
  if (!r.ok) { logoutSpotify(); return false; }
  saveToken(data);
  return true;
}

async function ensureToken() {
  if (!accessToken) return false;
  if (Date.now() < expiresAt - 60000) return true;
  return refreshToken();
}

async function spotifyUserAPI(path) {
  if (!(await ensureToken())) throw new Error("NOT_AUTHENTICATED");
  const r = await fetch("https://api.spotify.com/v1" + path, {
    headers:{Authorization:`Bearer ${accessToken}`}
  });
  if (r.status === 401 && await refreshToken()) return spotifyUserAPI(path);
  const data = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "Spotify API error");
  return data;
}

/* Public catalog is fetched through Vercel serverless function.
   Client Secret stays on the server in SPOTIFY_CLIENT_SECRET. */
async function catalog(action, params = {}) {
  const q = new URLSearchParams({action, ...params});
  const r = await fetch("/api/spotify?" + q);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Catalog API error");
  return data;
}

async function loadProfile() {
  try {
    const p = await spotifyUserAPI("/me");
    $("userName").textContent = p.display_name || p.id;
    if (p.images?.[0]?.url) $("userImage").src = p.images[0].url;
    $("loginButton").textContent = "Spotify Connected";
  } catch (e) {
    console.warn("Profile:", e.message);
  }
}

async function loadHome() {
  const grid = $("homeTracks");
  grid.innerHTML = `<div class="loading">Memuat musik Spotify...</div>`;
  try {
    const data = await catalog("search", {q:"popular", type:"track", limit:"12", market:"ID"});
    currentTracks = data.tracks?.items || [];
    renderMusicGrid(currentTracks, grid);
    $("searchInfo").textContent = "";
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty">Musik gagal dimuat: ${escapeHTML(e.message)}</div>`;
  }

  try {
    const data = await catalog("search", {q:"pop", type:"artist", limit:"8", market:"ID"});
    $("homeArtists").innerHTML = (data.artists?.items || []).map(a => `
      <div class="artist-card" onclick="openArtist('${a.id}')">
        <img src="${escapeHTML(a.images?.[0]?.url || "https://placehold.co/300")}" alt="">
        <h3>${escapeHTML(a.name)}</h3>
      </div>`).join("");
  } catch (e) {
    $("homeArtists").innerHTML = "";
  }
}

async function searchMusic(query) {
  query = String(query || "").trim();
  if (!query) return;
  showPage("search");
  $("searchResults").innerHTML = `<div class="loading">Mencari "${escapeHTML(query)}"... </div>`;
  try {
    const data = await catalog("search", {q:query, type:"track", limit:"20", market:"ID"});
    currentTracks = data.tracks?.items || [];
    $("searchInfo").textContent = `${currentTracks.length} hasil untuk "${query}"`;
    renderSearchResults(currentTracks);
  } catch (e) {
    console.error(e);
    $("searchResults").innerHTML = `<div class="empty">Gagal mencari: ${escapeHTML(e.message)}</div>`;
  }
}

function renderSearchResults(tracks) {
  $("searchResults").innerHTML = tracks.length ? tracks.map((t,i)=>`
    <div class="result">
      <img src="${escapeHTML(trackImage(t))}" alt="">
      <div>
        <div class="result-title">${escapeHTML(t.name)}</div>
        <div class="result-subtitle">${escapeHTML(t.artists.map(a=>a.name).join(", "))} • ${escapeHTML(t.album?.name)}</div>
      </div>
      <div class="result-buttons">
        <button onclick="playTrack(${i})">▶</button>
        <button onclick="openTrack(${i})">⋮</button>
        <button onclick="favoriteTrack(${i})">♡</button>
      </div>
    </div>`).join("") : `<div class="empty">Lagu tidak ditemukan.</div>`;
}

function renderMusicGrid(tracks, container) {
  container.innerHTML = tracks.length ? tracks.map((t,i)=>`
    <div class="music-card">
      <img src="${escapeHTML(trackImage(t))}" alt="">
      <div class="music-title">${escapeHTML(t.name)}</div>
      <div class="music-artist">${escapeHTML(t.artists.map(a=>a.name).join(", "))}</div>
      <div class="card-buttons">
        <button class="play" onclick="playTrack(${i})">▶</button>
        <button onclick="openTrack(${i})">⋮</button>
        <button onclick="favoriteTrack(${i})">♡</button>
      </div>
    </div>`).join("") : `<div class="empty">Tidak ada lagu.</div>`;
}

function playTrack(i) {
  const t = currentTracks[i];
  if (!t) return;
  currentTrack = t; currentIndex = i;
  $("playerImage").src = trackImage(t);
  $("playerTitle").textContent = t.name;
  $("playerArtist").textContent = t.artists.map(a=>a.name).join(", ");
  openCurrentSpotify();
}

function openCurrentSpotify() {
  const url = currentTrack?.external_urls?.spotify;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function nextTrack() {
  if (!currentTracks.length) return;
  playTrack((currentIndex + 1) % currentTracks.length);
}
function previousTrack() {
  if (!currentTracks.length) return;
  playTrack((currentIndex - 1 + currentTracks.length) % currentTracks.length);
}

function openTrack(i) {
  const t = currentTracks[i];
  if (!t) return;
  currentTrack = t; currentIndex = i;
  $("detailImage").src = trackImage(t);
  $("detailTitle").textContent = t.name;
  $("detailArtist").textContent = "Artis: " + t.artists.map(a=>a.name).join(", ");
  $("detailAlbum").textContent = "Album: " + (t.album?.name || "-");
  $("detailModal").classList.add("show");
}
function closeModal() { $("detailModal").classList.remove("show"); }

function getFavorites() {
  return JSON.parse(localStorage.getItem("tama_music_favorites") || "[]");
}
function favoriteTrack(i) {
  const t = currentTracks[i]; if (!t) return;
  let f = getFavorites();
  if (f.some(x=>x.id===t.id)) f=f.filter(x=>x.id!==t.id); else f.push(t);
  localStorage.setItem("tama_music_favorites", JSON.stringify(f));
  if ($("libraryPage").classList.contains("active")) loadLibrary();
}
function saveCurrentFavorite() {
  if (!currentTrack) return;
  let f=getFavorites();
  if (!f.some(x=>x.id===currentTrack.id)) f.push(currentTrack);
  localStorage.setItem("tama_music_favorites", JSON.stringify(f));
  loadLibrary();
}
function loadLibrary() {
  const f=getFavorites();
  currentTracks=f;
  renderMusicGrid(f, $("libraryGrid"));
}

async function openArtist(id) {
  try {
    const data=await catalog("artist-top-tracks",{id,market:"ID"});
    currentTracks=data.tracks||[];
    showPage("search");
    $("searchInfo").textContent="Top tracks artis";
    renderSearchResults(currentTracks);
  } catch(e) {
    $("searchResults").innerHTML=`<div class="empty">Gagal memuat artis.</div>`;
  }
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
  const p=$(page+"Page"); if(p) p.classList.add("active");
  const n=document.querySelector(`[data-page="${page}"]`); if(n)n.classList.add("active");
  if(page==="library") loadLibrary();
}
function focusSearch(){showPage("search");$("searchInput").focus();}
function logoutSpotify(){
  ["tama_spotify_access_token","tama_spotify_expires_at","tama_spotify_refresh_token"].forEach(k=>localStorage.removeItem(k));
  location.reload();
}

$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchMusic(e.target.value)});
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("loginButton").addEventListener("click",loginSpotify);
$("menuButton").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")closeModal();});

(async function init(){
  try { await handleCallback(); } catch(e) { console.error("Callback",e); }
  if (await ensureToken()) {
    await loadProfile();
  }
  await loadHome();
})();
