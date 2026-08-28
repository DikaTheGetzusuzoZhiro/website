/* =========================================
   TAMA MUSIC
   Spotify Web API + Authorization Code PKCE
========================================= */


/*
 * CLIENT ID SPOTIFY KAMU
 */

const CLIENT_ID =
  "3af5dfbf2bec4a40a0b0e6b3a0beaa9c";


/*
 * Redirect URI
 *
 * HARUS SAMA PERSIS dengan yang kamu
 * daftarkan di Spotify Developer Dashboard.
 *
 * Untuk Vercel misalnya:
 *
 * https://tama-music.vercel.app/
 */

const REDIRECT_URI =
  window.location.origin +
  window.location.pathname;


/*
 * Scope
 *
 * Untuk search + metadata publik,
 * kita tidak perlu meminta scope tambahan.
 *
 * Scope berikut dipakai kalau nanti ingin
 * membaca library user.
 */

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-library-read"
].join(" ");


/*
 * Spotify endpoints
 */

const AUTHORIZE_URL =
  "https://accounts.spotify.com/authorize";

const TOKEN_URL =
  "https://accounts.spotify.com/api/token";

const API_BASE =
  "https://api.spotify.com/v1";


/*
 * STATE
 */

let accessToken =
  localStorage.getItem(
    "tama_spotify_access_token"
  );

let expiresAt =
  Number(
    localStorage.getItem(
      "tama_spotify_expires_at"
    ) || 0
  );

let currentTracks = [];

let currentTrack = null;

let currentIndex = -1;

let currentArtists = [];


/* =========================================
   HELPERS
========================================= */

function randomString(length = 64) {

  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values =
    crypto.getRandomValues(
      new Uint8Array(length)
    );

  return Array.from(values)
    .map(
      value =>
        characters[
          value % characters.length
        ]
    )
    .join("");

}


async function sha256(value) {

  const encoder =
    new TextEncoder();

  const data =
    encoder.encode(value);

  return crypto.subtle.digest(
    "SHA-256",
    data
  );

}


function base64UrlEncode(buffer) {

  return btoa(
    String.fromCharCode(
      ...new Uint8Array(buffer)
    )
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

}


function escapeHTML(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================
   LOGIN
========================================= */

async function loginSpotify() {

  const codeVerifier =
    randomString(64);

  const state =
    randomString(32);

  const hashed =
    await sha256(
      codeVerifier
    );

  const codeChallenge =
    base64UrlEncode(
      hashed
    );


  localStorage.setItem(
    "tama_code_verifier",
    codeVerifier
  );

  localStorage.setItem(
    "tama_oauth_state",
    state
  );


  const params =
    new URLSearchParams({

      client_id:
        CLIENT_ID,

      response_type:
        "code",

      redirect_uri:
        REDIRECT_URI,

      state:
        state,

      scope:
        SCOPES,

      code_challenge_method:
        "S256",

      code_challenge:
        codeChallenge

    });


  window.location.href =
    AUTHORIZE_URL +
    "?" +
    params.toString();

}


/* =========================================
   CALLBACK
========================================= */

async function handleCallback() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const error =
    params.get("error");

  if (error) {

    console.error(
      "Spotify authorization:",
      error
    );

    history.replaceState(
      {},
      document.title,
      REDIRECT_URI
    );

    return;

  }


  const code =
    params.get("code");

  if (!code) {
    return;
  }


  const state =
    params.get("state");

  const savedState =
    localStorage.getItem(
      "tama_oauth_state"
    );


  if (
    !state ||
    state !== savedState
  ) {

    alert(
      "Login Spotify gagal: state tidak cocok."
    );

    return;

  }


  const verifier =
    localStorage.getItem(
      "tama_code_verifier"
    );


  if (!verifier) {

    alert(
      "PKCE verifier tidak ditemukan."
    );

    return;

  }


  const response =
    await fetch(
      TOKEN_URL,
      {

        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          new URLSearchParams({

            grant_type:
              "authorization_code",

            code:
              code,

            redirect_uri:
              REDIRECT_URI,

            client_id:
              CLIENT_ID,

            code_verifier:
              verifier

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(data);

    alert(
      "Gagal mendapatkan token Spotify."
    );

    return;

  }


  saveToken(
    data
  );


  history.replaceState(
    {},
    document.title,
    REDIRECT_URI
  );


  await loadProfile();

}


/* =========================================
   TOKEN
========================================= */

function saveToken(data) {

  accessToken =
    data.access_token;

  expiresAt =
    Date.now() +
    (
      Number(
        data.expires_in || 3600
      ) *
      1000
    );


  localStorage.setItem(
    "tama_spotify_access_token",
    accessToken
  );

  localStorage.setItem(
    "tama_spotify_expires_at",
    expiresAt
  );


  if (
    data.refresh_token
  ) {

    localStorage.setItem(
      "tama_spotify_refresh_token",
      data.refresh_token
    );

  }

}


async function refreshToken() {

  const refresh =
    localStorage.getItem(
      "tama_spotify_refresh_token"
    );


  if (!refresh) {

    accessToken = null;

    return false;

  }


  const response =
    await fetch(
      TOKEN_URL,
      {

        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          new URLSearchParams({

            grant_type:
              "refresh_token",

            refresh_token:
              refresh,

            client_id:
              CLIENT_ID

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    logoutSpotify();

    return false;

  }


  saveToken(
    data
  );


  return true;

}


async function ensureToken() {

  if (!accessToken) {
    return false;
  }


  if (
    Date.now() <
    expiresAt -
    60000
  ) {

    return true;

  }


  return refreshToken();

}


/* =========================================
   API
========================================= */

async function spotifyAPI(
  endpoint,
  options = {}
) {

  const valid =
    await ensureToken();


  if (!valid) {

    throw new Error(
      "NOT_AUTHENTICATED"
    );

  }


  const response =
    await fetch(
      API_BASE + endpoint,
      {

        ...options,

        headers: {

          ...(options.headers || {}),

          Authorization:
            `Bearer ${accessToken}`

        }

      }
    );


  if (
    response.status === 401
  ) {

    const refreshed =
      await refreshToken();


    if (!refreshed) {

      throw new Error(
        "TOKEN_EXPIRED"
      );

    }


    return spotifyAPI(
      endpoint,
      options
    );

  }


  if (
    response.status === 204
  ) {

    return null;

  }


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "Spotify API error:",
      data
    );

    throw new Error(
      data?.error?.message ||
      "Spotify API error"
    );

  }


  return data;

}


/* =========================================
   PROFILE
========================================= */

async function loadProfile() {

  try {

    const profile =
      await spotifyAPI(
        "/me"
      );


    document.getElementById(
      "userName"
    ).textContent =
      profile.display_name ||
      profile.id;


    if (
      profile.images &&
      profile.images.length
    ) {

      document.getElementById(
        "userImage"
      ).src =
        profile.images[0].url;

    }


    document.getElementById(
      "loginButton"
    ).textContent =
      "Spotify Connected";


  } catch (error) {

    console.error(
      error
    );

  }

}


/* =========================================
   SEARCH
========================================= */

async function searchMusic(
  query
) {

  if (!query.trim()) {
    return;
  }


  showPage(
    "search"
  );


  const results =
    document.getElementById(
      "searchResults"
    );


  const info =
    document.getElementById(
      "searchInfo"
    );


  results.innerHTML =
    `<div class="loading">
      Mencari musik...
    </div>`;


  try {

    const data =
      await spotifyAPI(
        "/search?" +
        new URLSearchParams({

          q:
            query,

          type:
            "track,artist,album",

          limit:
            "20",

          market:
            "ID"

        })
      );


    currentTracks =
      data.tracks?.items ||
      [];


    info.textContent =
      `${currentTracks.length} lagu untuk "${query}"`;


    renderSearchResults(
      currentTracks
    );


  } catch (error) {

    console.error(error);


    if (
      error.message ===
      "NOT_AUTHENTICATED"
    ) {

      results.innerHTML = `
        <div class="empty">
          <p>Login Spotify terlebih dahulu.</p>
          <br>
          <button
            class="green-button"
            onclick="loginSpotify()"
          >
            Login Spotify
          </button>
        </div>
      `;

      return;

    }


    results.innerHTML =
      `<div class="empty">
        Gagal mengambil data Spotify.
      </div>`;

  }

}


/* =========================================
   HOME
========================================= */

async function loadHome() {

  const grid =
    document.getElementById(
      "homeTracks"
    );


  grid.innerHTML =
    `<div class="loading">
      Memuat musik...
    </div>`;


  try {

    const data =
      await spotifyAPI(
        "/search?" +
        new URLSearchParams({

          q:
            "year:2026",

          type:
            "track",

          limit:
            "12",

          market:
            "ID"

        })
      );


    currentTracks =
      data.tracks?.items ||
      [];


    renderMusicGrid(
      currentTracks,
      grid
    );


  } catch (error) {

    grid.innerHTML = `
      <div class="empty">
        Login Spotify untuk memuat musik.
      </div>
    `;

  }


  loadArtists();

}


/* =========================================
   ARTISTS
========================================= */

async function loadArtists() {

  const grid =
    document.getElementById(
      "homeArtists"
    );


  try {

    const data =
      await spotifyAPI(
        "/search?" +
        new URLSearchParams({

          q:
            "genre:pop",

          type:
            "artist",

          limit:
            "8",

          market:
            "ID"

        })
      );


    currentArtists =
      data.artists?.items ||
      [];


    grid.innerHTML =
      currentArtists
        .map(
          artist => {

            const image =
              artist.images?.[1]?.url ||
              artist.images?.[0]?.url ||
              "https://placehold.co/300";


            return `

              <div
                class="artist-card"
                onclick="openArtist('${artist.id}')"
              >

                <img
                  src="${escapeHTML(image)}"
                  alt=""
                >

                <h3>
                  ${escapeHTML(
                    artist.name
                  )}
                </h3>

              </div>

            `;

          }
        )
        .join("");


  } catch {

    grid.innerHTML =
      "";

  }

}


/* =========================================
   SEARCH RESULTS
========================================= */

function renderSearchResults(
  tracks
) {

  const container =
    document.getElementById(
      "searchResults"
    );


  if (!tracks.length) {

    container.innerHTML =
      `<div class="empty">
        Lagu tidak ditemukan.
      </div>`;

    return;

  }


  container.innerHTML =
    tracks
      .map(
        (track, index) => {

          const image =
            getTrackImage(
              track
            );


          return `

            <div class="result">

              <img
                src="${escapeHTML(image)}"
                alt=""
              >

              <div>

                <div class="result-title">
                  ${escapeHTML(
                    track.name
                  )}
                </div>

                <div class="result-subtitle">
                  ${escapeHTML(
                    track.artists
                      .map(
                        artist =>
                          artist.name
                      )
                      .join(", ")
                  )}
                  •
                  ${escapeHTML(
                    track.album.name
                  )}
                </div>

              </div>

              <div class="result-buttons">

                <button
                  onclick="playTrack(${index})"
                >
                  ▶
                </button>

                <button
                  onclick="openTrack(${index})"
                >
                  ⋮
                </button>

                <button
                  onclick="favoriteTrack(${index})"
                >
                  ♡
                </button>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================
   MUSIC GRID
========================================= */

function renderMusicGrid(
  tracks,
  container
) {

  if (!tracks.length) {

    container.innerHTML =
      `<div class="empty">
        Tidak ada lagu.
      </div>`;

    return;

  }


  container.innerHTML =
    tracks
      .map(
        (track, index) => {

          const image =
            getTrackImage(
              track
            );


          return `

            <div class="music-card">

              <img
                src="${escapeHTML(image)}"
                alt=""
              >

              <div class="music-title">
                ${escapeHTML(
                  track.name
                )}
              </div>

              <div class="music-artist">
                ${escapeHTML(
                  track.artists
                    .map(
                      x =>
                        x.name
                    )
                    .join(", ")
                )}
              </div>

              <div class="card-buttons">

                <button
                  class="play"
                  onclick="playTrack(${index})"
                >
                  ▶
                </button>

                <button
                  onclick="openTrack(${index})"
                >
                  ⋮
                </button>

                <button
                  onclick="favoriteTrack(${index})"
                >
                  ♡
                </button>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================
   IMAGE
========================================= */

function getTrackImage(
  track
) {

  return (
    track?.album?.images?.[0]?.url ||
    track?.album?.images?.[1]?.url ||
    "https://placehold.co/500x500/181818/ffffff?text=TAMA"
  );

}


/* =========================================
   TRACK
========================================= */

function playTrack(
  index
) {

  const track =
    currentTracks[index];


  if (!track) {
    return;
  }


  currentTrack =
    track;

  currentIndex =
    index;


  document.getElementById(
    "playerImage"
  ).src =
    getTrackImage(
      track
    );


  document.getElementById(
    "playerTitle"
  ).textContent =
    track.name;


  document.getElementById(
    "playerArtist"
  ).textContent =
    track.artists
      .map(
        artist =>
          artist.name
      )
      .join(", ");


  document.getElementById(
    "mainPlay"
  ).textContent =
    "▶";


  /*
   * Spotify Web API tidak memberikan
   * file audio MP3 untuk kita putar
   * langsung dari website.
   *
   * Jadi tombol player membuka Spotify.
   */

  openCurrentSpotify();

}


/* =========================================
   OPEN SPOTIFY
========================================= */

function openCurrentSpotify() {

  if (!currentTrack) {

    return;

  }


  if (
    currentTrack.external_urls &&
    currentTrack.external_urls.spotify
  ) {

    window.open(
      currentTrack.external_urls.spotify,
      "_blank",
      "noopener"
    );

  }

}


/* =========================================
   NEXT / PREVIOUS
========================================= */

function nextTrack() {

  if (
    !currentTracks.length
  ) {

    return;

  }


  let index =
    currentIndex + 1;


  if (
    index >=
    currentTracks.length
  ) {

    index = 0;

  }


  playTrack(
    index
  );

}


function previousTrack() {

  if (
    !currentTracks.length
  ) {

    return;

  }


  let index =
    currentIndex - 1;


  if (
    index < 0
  ) {

    index =
      currentTracks.length - 1;

  }


  playTrack(
    index
  );

}


/* =========================================
   DETAIL
========================================= */

function openTrack(
  index
) {

  const track =
    currentTracks[index];


  if (!track) {
    return;
  }


  currentTrack =
    track;

  currentIndex =
    index;


  document.getElementById(
    "detailImage"
  ).src =
    getTrackImage(
      track
    );


  document.getElementById(
    "detailTitle"
  ).textContent =
    track.name;


  document.getElementById(
    "detailArtist"
  ).textContent =
    "Artis: " +
    track.artists
      .map(
        artist =>
          artist.name
      )
      .join(", ");


  document.getElementById(
    "detailAlbum"
  ).textContent =
    "Album: " +
    track.album.name;


  document
    .getElementById(
      "detailModal"
    )
    .classList.add(
      "show"
    );

}


function closeModal() {

  document
    .getElementById(
      "detailModal"
    )
    .classList.remove(
      "show"
    );

}


/* =========================================
   FAVORITE
========================================= */

function getLocalFavorites() {

  return JSON.parse(
    localStorage.getItem(
      "tama_music_favorites"
    ) || "[]"
  );

}


function favoriteTrack(
  index
) {

  const track =
    currentTracks[index];


  if (!track) {
    return;
  }


  let favorites =
    getLocalFavorites();


  const exists =
    favorites.some(
      item =>
        item.id ===
        track.id
    );


  if (exists) {

    favorites =
      favorites.filter(
        item =>
          item.id !==
          track.id
      );

  } else {

    favorites.push(
      track
    );

  }


  localStorage.setItem(
    "tama_music_favorites",
    JSON.stringify(
      favorites
    )
  );


  loadLibrary();

}


function saveCurrentFavorite() {

  if (!currentTrack) {
    return;
  }


  let favorites =
    getLocalFavorites();


  const exists =
    favorites.some(
      item =>
        item.id ===
        currentTrack.id
    );


  if (!exists) {

    favorites.push(
      currentTrack
    );

  }


  localStorage.setItem(
    "tama_music_favorites",
    JSON.stringify(
      favorites
    )
  );


  loadLibrary();

}


/* =========================================
   LIBRARY
========================================= */

function loadLibrary() {

  const grid =
    document.getElementById(
      "libraryGrid"
    );


  const favorites =
    getLocalFavorites();


  currentTracks =
    favorites;


  if (!favorites.length) {

    grid.innerHTML =
      `<div class="empty">
        Belum ada lagu favorit.
      </div>`;

    return;

  }


  renderMusicGrid(
    favorites,
    grid
  );

}


/* =========================================
   ARTIST
========================================= */

async function openArtist(
  artistId
) {

  try {

    const data =
      await spotifyAPI(
        `/artists/${artistId}/top-tracks?market=ID`
      );


    currentTracks =
      data.tracks ||
      [];


    showPage(
      "search"
    );


    document.getElementById(
      "searchInfo"
    ).textContent =
      "Top tracks artis";


    renderSearchResults(
      currentTracks
    );


  } catch (error) {

    console.error(
      error
    );

  }

}


/* =========================================
   NAVIGATION
========================================= */

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      element =>
        element.classList.remove(
          "active"
        )
    );


  document
    .querySelectorAll(
      ".nav"
    )
    .forEach(
      element =>
        element.classList.remove(
          "active"
        )
    );


  const pageElement =
    document.getElementById(
      page + "Page"
    );


  if (pageElement) {

    pageElement.classList.add(
      "active"
    );

  }


  const nav =
    document.querySelector(
      `[data-page="${page}"]`
    );


  if (nav) {

    nav.classList.add(
      "active"
    );

  }


  if (
    page ===
    "library"
  ) {

    loadLibrary();

  }

}


/* =========================================
   SEARCH INPUT
========================================= */

document
  .getElementById(
    "searchInput"
  )
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        searchMusic(
          event.target.value
        );

      }

    }
  );


/* =========================================
   NAV BUTTONS
========================================= */

document
  .querySelectorAll(
    ".nav"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );


          document
            .getElementById(
              "sidebar"
            )
            .classList.remove(
              "open"
            );

        }
      );

    }
  );


/* =========================================
   LOGIN BUTTON
========================================= */

document
  .getElementById(
    "loginButton"
  )
  .addEventListener(
    "click",
    loginSpotify
  );


/* =========================================
   MOBILE MENU
========================================= */

document
  .getElementById(
    "menuButton"
  )
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "sidebar"
        )
        .classList.toggle(
          "open"
        );

    }
  );


/* =========================================
   SEARCH FOCUS
========================================= */

function focusSearch() {

  showPage(
    "search"
  );

  document
    .getElementById(
      "searchInput"
    )
    .focus();

}


/* =========================================
   LOGOUT
========================================= */

function logoutSpotify() {

  localStorage.removeItem(
    "tama_spotify_access_token"
  );

  localStorage.removeItem(
    "tama_spotify_expires_at"
  );

  localStorage.removeItem(
    "tama_spotify_refresh_token"
  );

  accessToken =
    null;

  location.reload();

}


/* =========================================
   INITIALIZE
========================================= */

async function init() {

  await handleCallback();


  if (
    await ensureToken()
  ) {

    await loadProfile();

    await loadHome();

  } else {

    /*
     * Tanpa login, Spotify Web API
     * tidak akan dipanggil dari website ini.
     */

    document.getElementById(
      "homeTracks"
    ).innerHTML = `
      <div class="empty">
        <p>Login Spotify untuk mulai mencari musik.</p>
        <br>
        <button
          class="green-button"
          onclick="loginSpotify()"
        >
          Login Spotify
        </button>
      </div>
    `;

  }

}


init();
