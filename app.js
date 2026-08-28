const CLIENT_ID = "3af5dfbf2bec4a40a0b0e6b3a0beaa9c";

/*
 * PENTING:
 * Redirect URI harus SAMA PERSIS dengan yang ada
 * di Spotify Developer Dashboard.
 *
 * Untuk Vercel, contoh:
 * https://website-three-weld-9t4erfvh7y.vercel.app/
 */

const REDIRECT_URI = window.location.origin + window.location.pathname;

const SCOPES = "";

let accessToken = localStorage.getItem("spotify_access_token");
let currentTracks = [];
let currentIndex = -1;
let isPlaying = false;

const audio = new Audio();
audio.volume = 0.8;

const $ = id => document.getElementById(id);

function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values)
    .map(x => chars[x % chars.length])
    .join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function loginSpotify() {

  const verifier = randomString();

  const challenge = base64url(
    await sha256(verifier)
  );

  const state = randomString(32);

  localStorage.setItem("spotify_verifier", verifier);
  localStorage.setItem("spotify_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge
  });

  window.location.href =
    "https://accounts.spotify.com/authorize?" +
    params.toString();
}

async function handleCallback() {

  const params = new URLSearchParams(window.location.search);

  const code = params.get("code");
  const state = params.get("state");

  if (!code) return;

  const savedState = localStorage.getItem("spotify_state");

  if (state !== savedState) {
    alert("Login Spotify tidak valid.");
    return;
  }

  const verifier =
    localStorage.getItem("spotify_verifier");

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
      })
    }
  );

  const data = await response.json();

  if (data.access_token) {

    accessToken = data.access_token;

    localStorage.setItem(
      "spotify_access_token",
      accessToken
    );

    if (data.refresh_token) {
      localStorage.setItem(
        "spotify_refresh_token",
        data.refresh_token
      );
    }

    history.replaceState(
      {},
      document.title,
      REDIRECT_URI
    );

    $("loginBtn").textContent = "Spotify Connected";

    await searchTracks("popular music");
  } else {
    console.error(data);
    alert("Gagal login Spotify.");
  }
}

async function api(endpoint) {

  if (!accessToken) {
    throw new Error("NOT_LOGGED_IN");
  }

  const response = await fetch(
    "https://api.spotify.com/v1" + endpoint,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (response.status === 401) {
    localStorage.removeItem("spotify_access_token");
    accessToken = null;

    throw new Error("TOKEN_EXPIRED");
  }

  return response.json();
}

async function searchTracks(query) {

  if (!query.trim()) return;

  $("searchPage").classList.add("active-page");
  $("homePage").classList.remove("active-page");
  $("libraryPage").classList.remove("active-page");

  $("searchStatus").textContent =
    `Hasil pencarian untuk "${query}"`;

  $("searchResults").innerHTML =
    `<div class="loading">Mencari musik...</div>`;

  try {

    const data = await api(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=20&market=ID`
    );

    currentTracks = data.tracks.items;

    renderResults(currentTracks);

  } catch (error) {

    $("searchResults").innerHTML =
      `<p>Silakan login Spotify terlebih dahulu.</p>`;
  }
}

function renderResults(tracks) {

  if (!tracks.length) {
    $("searchResults").innerHTML =
      "<p>Tidak ada hasil.</p>";

    return;
  }

  $("searchResults").innerHTML =
    tracks.map((track, index) => {

      const image =
        track.album.images?.[1]?.url ||
        track.album.images?.[0]?.url ||
        "https://via.placeholder.com/300";

      return `
        <div class="result">

          <img src="${image}">

          <div class="result-info">
            <h3>${escapeHtml(track.name)}</h3>
            <p>
              ${escapeHtml(track.artists.map(a => a.name).join(", "))}
              •
              ${escapeHtml(track.album.name)}
            </p>
          </div>

          <div class="result-actions">

            <button onclick="playTrack(${index})">
              ▶
            </button>

            <button onclick="showDetails(${index})">
              ⋮
            </button>

            <button onclick="toggleFavorite(${index})">
              ♡
            </button>

          </div>

        </div>
      `;

    }).join("");
}

function playTrack(index) {

  const track = currentTracks[index];

  if (!track) return;

  /*
   * Spotify Web API metadata tidak menyediakan MP3
   * untuk kita download/host.
   *
   * preview_url juga dapat tidak tersedia.
   */

  currentIndex = index;

  $("playerTitle").textContent = track.name;

  $("playerArtist").textContent =
    track.artists.map(a => a.name).join(", ");

  $("playerCover").src =
    track.album.images?.[0]?.url ||
    "https://via.placeholder.com/300";

  if (track.preview_url) {

    audio.src = track.preview_url;

    audio.play();

    isPlaying = true;

    $("playBtn").textContent = "❚❚";

  } else {

    isPlaying = false;

    $("playBtn").textContent = "▶";

    alert(
      "Preview audio tidak tersedia untuk lagu ini. Tekan 'Buka di Spotify' untuk mendengarkan."
    );
  }
}

function togglePlay() {

  if (!audio.src) return;

  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    $("playBtn").textContent = "▶";
  } else {
    audio.play();
    isPlaying = true;
    $("playBtn").textContent = "❚❚";
  }
}

function nextTrack() {

  if (!currentTracks.length) return;

  let next = currentIndex + 1;

  if (next >= currentTracks.length) {
    next = 0;
  }

  playTrack(next);
}

function previousTrack() {

  if (!currentTracks.length) return;

  let previous = currentIndex - 1;

  if (previous < 0) {
    previous = currentTracks.length - 1;
  }

  playTrack(previous);
}

function showDetails(index) {

  const track = currentTracks[index];

  if (!track) return;

  $("detailCover").src =
    track.album.images?.[0]?.url ||
    "https://via.placeholder.com/300";

  $("detailTitle").textContent =
    track.name;

  $("detailArtist").textContent =
    "Artis: " +
    track.artists.map(a => a.name).join(", ");

  $("detailAlbum").textContent =
    "Album: " + track.album.name;

  $("spotifyLink").href =
    track.external_urls.spotify;

  $("lyricsText").textContent =
    "Lirik tidak disediakan oleh Spotify Web API. " +
    "Gunakan sumber lirik berlisensi jika ingin menambahkan fitur lirik.";

  $("detailModal").classList.add("show");
}

function closeModal() {
  $("detailModal").classList.remove("show");
}

function toggleFavorite(index) {

  const track = currentTracks[index];

  if (!track) return;

  let favorites =
    JSON.parse(
      localStorage.getItem("tama_favorites") || "[]"
    );

  const exists =
    favorites.some(x => x.id === track.id);

  if (exists) {

    favorites =
      favorites.filter(x => x.id !== track.id);

  } else {

    favorites.push(track);
  }

  localStorage.setItem(
    "tama_favorites",
    JSON.stringify(favorites)
  );

  alert(
    exists
      ? "Dihapus dari favorit."
      : "Ditambahkan ke favorit."
  );
}

function loadLibrary() {

  const favorites =
    JSON.parse(
      localStorage.getItem("tama_favorites") || "[]"
    );

  currentTracks = favorites;

  if (!favorites.length) {

    $("libraryGrid").innerHTML =
      `<p style="color:#888">
        Belum ada lagu favorit.
      </p>`;

    return;
  }

  $("libraryGrid").innerHTML =
    favorites.map((track, index) => {

      const image =
        track.album.images?.[0]?.url ||
        "https://via.placeholder.com/300";

      return `
        <div class="card">

          <img src="${image}">

          <h3>${escapeHtml(track.name)}</h3>

          <p>
            ${escapeHtml(
              track.artists.map(a => a.name).join(", ")
            )}
          </p>

          <div class="card-buttons">

            <button
              class="green"
              onclick="playTrack(${index})">
              ▶
            </button>

            <button
              onclick="showDetails(${index})">
              ⋮
            </button>

          </div>

        </div>
      `;

    }).join("");
}

function searchPopular() {

  $("searchInput").value =
    "popular music";

  searchTracks("popular music");
}

function focusSearch() {

  $("searchInput").focus();

  $("searchInput").scrollIntoView({
    behavior: "smooth"
  });
}

function escapeHtml(text) {

  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("searchInput").addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      searchTracks(event.target.value);
    }

  }
);

$("loginBtn").addEventListener(
  "click",
  loginSpotify
);

document.querySelectorAll(".nav").forEach(button => {

  button.addEventListener("click", () => {

    document
      .querySelectorAll(".nav")
      .forEach(x => x.classList.remove("active"));

    button.classList.add("active");

    const page = button.dataset.page;

    document
      .querySelectorAll(".page")
      .forEach(x => x.classList.remove("active-page"));

    if (page === "home") {
      $("homePage").classList.add("active-page");
    }

    if (page === "search") {
      $("searchPage").classList.add("active-page");
    }

    if (page === "library") {
      $("libraryPage").classList.add("active-page");
    }

    if (page === "library") {
      loadLibrary();
    }

  });

});

$("menuBtn").addEventListener("click", () => {
  document
    .querySelector(".sidebar")
    .classList.toggle("open");
});

$("volume").addEventListener(
  "input",
  event => {
    audio.volume =
      Number(event.target.value) / 100;
  }
);

audio.addEventListener(
  "timeupdate",
  () => {

    if (!audio.duration) return;

    $("progress").value =
      (audio.currentTime / audio.duration) * 100;

    $("currentTime").textContent =
      formatTime(audio.currentTime);

    $("duration").textContent =
      formatTime(audio.duration);
  }
);

$("progress").addEventListener(
  "input",
  event => {

    if (!audio.duration) return;

    audio.currentTime =
      (Number(event.target.value) / 100) *
      audio.duration;
  }
);

audio.addEventListener(
  "ended",
  nextTrack
);

function formatTime(seconds) {

  if (!seconds || isNaN(seconds)) {
    return "0:00";
  }

  const min =
    Math.floor(seconds / 60);

  const sec =
    Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");

  return `${min}:${sec}`;
}

async function init() {

  await handleCallback();

  if (accessToken) {

    $("loginBtn").textContent =
      "Spotify Connected";

    try {
      await searchTracks("popular music");
    } catch {}
  }
}

init();
