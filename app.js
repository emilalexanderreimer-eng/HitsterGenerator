"use strict";

/* ============================================================
   STATE
   ============================================================ */
const STORAGE_KEY_ENTRIES = "hitster-generator-entries-v1";
const STORAGE_KEY_SETTINGS = "hitster-generator-settings-v1";
const CARDS_PER_PAGE = 6; // 2 columns x 3 rows at 8x8cm fits one A4 page

let entries = [];
let settings = {
  prefix: "A",
  startnum: 1,
  ytApiKey: "",
  ytPlaylistId: "PLoaTDHRuxwgxk0WTXRJJJlXUYuHBSrbcF",
  spotifyClientId: "",
  spotifyClientSecret: ""
};
let editingId = null;

/* ============================================================
   PERSISTENCE
   ============================================================ */
function loadState() {
  try {
    const rawEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (rawEntries) entries = JSON.parse(rawEntries);
  } catch (e) { entries = []; }

  try {
    const rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (rawSettings) settings = Object.assign(settings, JSON.parse(rawSettings));
  } catch (e) { /* keep defaults */ }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

/* ============================================================
   HELPERS
   ============================================================ */
function uid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function decadeColor(year) {
  const y = Number(year) || 0;
  const decade = Math.floor(y / 10);
  const hue = (decade * 53) % 360;
  return `hsl(${hue} 58% 47%)`;
}

function spotifySearchUrl(entry) {
  const q = `${entry.title} ${entry.artist}`.trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function setStatus(msg, persistent) {
  const el = document.getElementById("status");
  el.textContent = msg;
  clearTimeout(setStatus._t);
  if (msg && !persistent) {
    setStatus._t = setTimeout(() => { el.textContent = ""; }, 3500);
  }
}

function suggestNextCode() {
  const prefix = (settings.prefix || "A").trim() || "A";
  const used = new Set(entries.map((e) => e.code));
  let n = Number(settings.startnum) || 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

/* ============================================================
   FORM HANDLING
   ============================================================ */
function fillFormDefaults() {
  document.getElementById("code").value = suggestNextCode();
}

function resetForm() {
  document.getElementById("card-form").reset();
  editingId = null;
  document.getElementById("submit-btn").textContent = "Karte hinzufügen";
  document.getElementById("cancel-edit-btn").hidden = true;
  fillFormDefaults();
  document.getElementById("year").focus();
}

function loadEntryIntoForm(entry) {
  editingId = entry.id;
  document.getElementById("year").value = entry.year;
  document.getElementById("artist").value = entry.artist;
  document.getElementById("title").value = entry.title;
  document.getElementById("link").value = entry.link || "";
  document.getElementById("code").value = entry.code;
  document.getElementById("submit-btn").textContent = "Aktualisieren";
  document.getElementById("cancel-edit-btn").hidden = false;
  document.getElementById("form-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleFormSubmit(ev) {
  ev.preventDefault();

  const year = document.getElementById("year").value.trim();
  const artist = document.getElementById("artist").value.trim();
  const title = document.getElementById("title").value.trim();
  const link = document.getElementById("link").value.trim();
  let code = document.getElementById("code").value.trim();

  if (!year || !artist || !title) {
    setStatus("Bitte Jahr, Interpret und Titel ausfüllen.");
    return;
  }
  if (!code) code = suggestNextCode();

  // make sure code stays unique (ignore the entry currently being edited)
  const codeTaken = entries.some((e) => e.code === code && e.id !== editingId);
  if (codeTaken) {
    setStatus(`Code "${code}" wird schon verwendet — bitte einen anderen wählen.`);
    return;
  }

  if (editingId) {
    const entry = entries.find((e) => e.id === editingId);
    Object.assign(entry, { year, artist, title, link, code });
    setStatus("Karte aktualisiert.");
  } else {
    entries.push({ id: uid(), year, artist, title, link, code });
    setStatus("Karte hinzugefügt.");
  }

  saveState();
  resetForm();
  renderAll();
}

/* ============================================================
   LIST (entries table)
   ============================================================ */
function moveEntry(id, dir) {
  const i = entries.findIndex((e) => e.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= entries.length) return;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  saveState();
  renderAll();
}

function deleteEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  if (!confirm(`Karte "${entry.code}" (${entry.year} – ${entry.artist}) wirklich löschen?`)) return;
  entries = entries.filter((e) => e.id !== id);
  if (editingId === id) resetForm();
  saveState();
  renderAll();
}

function renderEntriesTable() {
  const body = document.getElementById("entries-body");
  const emptyHint = document.getElementById("empty-list-hint");
  body.innerHTML = "";

  document.getElementById("entry-count").textContent = entries.length;
  emptyHint.style.display = entries.length === 0 ? "block" : "none";

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-order">
        <button type="button" class="row-btn" data-action="up" data-id="${entry.id}" ${i === 0 ? "disabled" : ""} title="Nach oben">▲</button>
        <button type="button" class="row-btn" data-action="down" data-id="${entry.id}" ${i === entries.length - 1 ? "disabled" : ""} title="Nach unten">▼</button>
      </td>
      <td class="cell-code">${escapeHtml(entry.code)}</td>
      <td>${escapeHtml(entry.year)}</td>
      <td>${escapeHtml(entry.artist)}</td>
      <td class="cell-title">${escapeHtml(entry.title)}</td>
      <td class="col-actions">
        <button type="button" class="row-btn" data-action="edit" data-id="${entry.id}" title="Bearbeiten">✎</button>
        <button type="button" class="row-btn danger" data-action="delete" data-id="${entry.id}" title="Löschen">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function handleTableClick(ev) {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === "up") moveEntry(id, -1);
  else if (action === "down") moveEntry(id, 1);
  else if (action === "delete") deleteEntry(id);
  else if (action === "edit") {
    const entry = entries.find((e) => e.id === id);
    if (entry) loadEntryIntoForm(entry);
  }
}

/* ============================================================
   PRINT PAGES (front / back)
   ============================================================ */
function buildPageLabel(text) {
  const div = document.createElement("div");
  div.className = "page-label";
  div.textContent = text;
  return div;
}

function buildCardFront(entry) {
  const card = document.createElement("div");
  card.className = "card front";
  card.innerHTML = `
    <div class="decade-stripe" style="background:${decadeColor(entry.year)}"></div>
    <div class="qr-slot" data-qr-for="${entry.id}"></div>
    <div class="code-tag">${escapeHtml(entry.code)}</div>
  `;
  return card;
}

function buildCardBack(entry) {
  const card = document.createElement("div");
  card.className = "card back";
  card.innerHTML = `
    <div class="decade-stripe" style="background:${decadeColor(entry.year)}"></div>
    <div class="back-content">
      <div class="year">${escapeHtml(entry.year)}</div>
      <div class="artist">${escapeHtml(entry.artist)}</div>
      <div class="title">${escapeHtml(entry.title)}</div>
    </div>
    <div class="code-tag">${escapeHtml(entry.code)}</div>
  `;
  return card;
}

function buildPage(group, side) {
  const page = document.createElement("div");
  page.className = "page";
  const grid = document.createElement("div");
  grid.className = "grid";
  group.forEach((entry) => {
    grid.appendChild(side === "front" ? buildCardFront(entry) : buildCardBack(entry));
  });
  page.appendChild(grid);
  return page;
}

function renderPages() {
  const pagesEl = document.getElementById("pages");
  pagesEl.innerHTML = "";

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Noch keine Karten — füge links deine erste Karte hinzu, um die Druckvorschau zu sehen.";
    pagesEl.appendChild(p);
    updateCountInfo();
    return;
  }

  const groups = chunk(entries, CARDS_PER_PAGE);

  groups.forEach((group, i) => {
    pagesEl.appendChild(buildPageLabel(`Vorderseiten — Seite ${i + 1} von ${groups.length}`));
    pagesEl.appendChild(buildPage(group, "front"));
  });
  groups.forEach((group, i) => {
    pagesEl.appendChild(buildPageLabel(`Rückseiten — Seite ${i + 1} von ${groups.length}`));
    pagesEl.appendChild(buildPage(group, "back"));
  });

  renderAllQrCodes();
  updateCountInfo();
}

function renderAllQrCodes() {
  if (typeof QRCode === "undefined") return; // CDN library not loaded (e.g. offline)
  document.querySelectorAll(".qr-slot").forEach((slot) => {
    const entry = entries.find((e) => e.id === slot.dataset.qrFor);
    if (!entry) return;
    const content = entry.link ? entry.link : spotifySearchUrl(entry);
    slot.innerHTML = "";
    // eslint-disable-next-line no-new
    new QRCode(slot, {
      text: content,
      width: 300,
      height: 300,
      correctLevel: QRCode.CorrectLevel.M
    });
  });
}

function updateCountInfo() {
  const pages = Math.ceil(entries.length / CARDS_PER_PAGE);
  document.getElementById("count-info").textContent =
    entries.length === 0
      ? "0 Karten"
      : `${entries.length} Karte${entries.length === 1 ? "" : "n"} · ${pages} Vorder- + ${pages} Rückseite${pages === 1 ? "" : "n"} (je 6 Karten pro A4-Seite)`;
}

/* ============================================================
   SETTINGS
   ============================================================ */
function bindSettings() {
  const prefixEl = document.getElementById("prefix");
  const startEl = document.getElementById("startnum");
  prefixEl.value = settings.prefix;
  startEl.value = settings.startnum;

  function persistAndSuggest() {
    settings.prefix = prefixEl.value.trim() || "A";
    settings.startnum = Number(startEl.value) || 1;
    saveState();
    if (!editingId) document.getElementById("code").value = suggestNextCode();
  }

  prefixEl.addEventListener("change", persistAndSuggest);
  startEl.addEventListener("change", persistAndSuggest);

  document.getElementById("renumber-btn").addEventListener("click", () => {
    const prefix = settings.prefix || "A";
    const start = Number(settings.startnum) || 1;
    entries.forEach((entry, i) => { entry.code = prefix + (start + i); });
    saveState();
    renderAll();
    setStatus("Codes wurden neu vergeben.");
  });

  // YouTube source settings
  const ytKeyEl = document.getElementById("yt-api-key");
  const ytPlaylistEl = document.getElementById("yt-playlist-id");
  ytKeyEl.value = settings.ytApiKey || "";
  ytPlaylistEl.value = settings.ytPlaylistId || DEFAULT_YT_PLAYLIST_ID;

  function persistYt() {
    settings.ytApiKey = ytKeyEl.value.trim();
    settings.ytPlaylistId = ytPlaylistEl.value.trim() || DEFAULT_YT_PLAYLIST_ID;
    saveState();
    updateCacheInfo(readPlaylistCache());
  }
  ytKeyEl.addEventListener("change", persistYt);
  ytPlaylistEl.addEventListener("change", persistYt);

  document.getElementById("refresh-cache-btn").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-cache-btn");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Lade …";
    try {
      const items = await refreshPlaylistCache();
      setStatus(`Playlist-Cache aktualisiert: ${items.length} Songs.`);
    } catch (err) {
      setStatus(youtubeErrorMessage(err));
    }
    btn.disabled = false;
    btn.textContent = original;
  });

  updateCacheInfo(readPlaylistCache());

  // Spotify credentials
  const spClientIdEl = document.getElementById("spotify-client-id");
  const spClientSecretEl = document.getElementById("spotify-client-secret");
  spClientIdEl.value = settings.spotifyClientId || "";
  spClientSecretEl.value = settings.spotifyClientSecret || "";

  function persistSpotify() {
    settings.spotifyClientId = spClientIdEl.value.trim();
    settings.spotifyClientSecret = spClientSecretEl.value.trim();
    spotifyTokenCache = { token: null, expiresAt: 0 }; // credentials changed — force a fresh token next time
    saveState();
  }
  spClientIdEl.addEventListener("change", persistSpotify);
  spClientSecretEl.addEventListener("change", persistSpotify);
}

/* ============================================================
   IMPORT / EXPORT
   ============================================================ */
function exportJson() {
  const data = JSON.stringify({ settings, entries }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hitster-karten.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("JSON exportiert.");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error("Ungültiges Format");
      entries = data.entries.map((e) => ({
        id: uid(),
        year: e.year ?? "",
        artist: e.artist ?? "",
        title: e.title ?? "",
        link: e.link ?? "",
        code: e.code ?? ""
      }));
      if (data.settings) settings = Object.assign(settings, data.settings);
      saveState();
      renderAll();
      setStatus(`${entries.length} Karten importiert.`);
    } catch (err) {
      setStatus("Import fehlgeschlagen: Datei ist kein gültiges JSON aus diesem Generator.");
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   RANDOM GENERATOR — sources real songs from a public YouTube
   playlist via the YouTube Data API v3 (official, free, 10,000
   quota units/day), then looks each one up via the Spotify Web
   API (Client Credentials flow) to get the release year AND the
   exact, playable Spotify track link in one step. YouTube is only
   used for song discovery (it has no "release year" field and no
   officially sanctioned way to control background playback from
   a third-party app); Spotify is the actual playback target, via
   its official App Remote SDK in the planned Android app.

   Spotify lookups are throttled and rate-limit / auth failures are
   detected explicitly (instead of silently looping through the
   whole playlist with zero results): after several failed lookups
   in a row, generation stops early and tells you what's wrong.

   The playlist's videos are cached in localStorage so repeated
   clicks don't re-fetch the whole playlist every time.

   Setup needed:
   - A free YouTube Data API v3 key ("YouTube-Quelle" panel)
   - A Spotify Client ID + Client Secret ("Spotify-Anbindung" panel),
     from a free Spotify Developer "Development Mode" app — requires
     the app owner's Spotify account to have an active Premium plan
   ============================================================ */

const DEFAULT_YT_PLAYLIST_ID = "PLoaTDHRuxwgxk0WTXRJJJlXUYuHBSrbcF"; // "1000 Greatest Songs Of All Time" (983 videos)
const YOUTUBE_PLAYLIST_CACHE_KEY = "hitster-generator-yt-cache-v1";

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- YouTube title parsing (artist / title only — year & link come from Spotify) ---
function cleanYoutubeTitle(raw) {
  return raw
    .replace(/[([][^()[\]]*(official|video|audio|lyric|hd|hq|remaster|version|visualizer)[^()[\]]*[)\]]/gi, "")
    .replace(/[([](19[0-9]{2}|20[0-9]{2})[)\]]/g, "") // strip a bare year annotation in the title, if any
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseArtistTitle(rawTitle) {
  const cleaned = cleanYoutubeTitle(rawTitle);
  const separators = [" - ", " – ", " — ", ": "];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const artist = cleaned.slice(0, idx).trim();
      const title = cleaned.slice(idx + sep.length).trim();
      if (artist && title) return { artist, title };
    }
  }
  return null; // can't confidently tell artist apart from title — skip it
}

// --- YouTube Data API v3 (song discovery only) ---
function youtubeErrorMessage(err) {
  const msg = (err && err.message) || "";
  if (!settings.ytApiKey) return "Bitte zuerst einen YouTube-API-Key unter „YouTube-Quelle“ eintragen.";
  if (/API key not valid|keyInvalid/i.test(msg)) return "YouTube-API-Key ungültig — bitte unter „YouTube-Quelle“ prüfen.";
  if (/quotaExceeded/i.test(msg)) return "YouTube-Tageskontingent aufgebraucht — morgen erneut versuchen.";
  if (/playlistNotFound/i.test(msg)) return "Playlist-ID nicht gefunden — bitte ID prüfen.";
  return `YouTube-API-Fehler: ${msg || "unbekannt"}. Internetverbindung & API-Key prüfen.`;
}

async function fetchYoutubePlaylistPage(pageToken) {
  const params = new URLSearchParams({
    part: "snippet",
    maxResults: "50",
    playlistId: settings.ytPlaylistId || DEFAULT_YT_PLAYLIST_ID,
    key: settings.ytApiKey
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function refreshPlaylistCache() {
  if (!settings.ytApiKey) throw new Error("missing-key");
  const items = [];
  let pageToken = "";
  let guard = 0;
  do {
    const data = await fetchYoutubePlaylistPage(pageToken);
    (data.items || []).forEach((it) => {
      const videoId = it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId;
      const title = it.snippet && it.snippet.title;
      const publishedAt = it.snippet && it.snippet.publishedAt;
      if (videoId && title && title !== "Deleted video" && title !== "Private video") {
        items.push({ videoId, title, publishedAt: publishedAt || null });
      }
    });
    pageToken = data.nextPageToken || "";
    guard++;
  } while (pageToken && guard < 40); // safety cap: ~2000 videos

  const cache = { playlistId: settings.ytPlaylistId || DEFAULT_YT_PLAYLIST_ID, items, cachedAt: Date.now() };
  localStorage.setItem(YOUTUBE_PLAYLIST_CACHE_KEY, JSON.stringify(cache));
  updateCacheInfo(cache);
  return items;
}

function readPlaylistCache() {
  try {
    const raw = localStorage.getItem(YOUTUBE_PLAYLIST_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const wantedId = settings.ytPlaylistId || DEFAULT_YT_PLAYLIST_ID;
    if (cache && cache.playlistId === wantedId && Array.isArray(cache.items) && cache.items.length) {
      return cache;
    }
  } catch (e) { /* ignore corrupt cache */ }
  return null;
}

async function ensurePlaylistCache() {
  const cached = readPlaylistCache();
  if (cached) {
    updateCacheInfo(cached);
    return cached.items;
  }
  return await refreshPlaylistCache();
}

function updateCacheInfo(cache) {
  const el = document.getElementById("yt-cache-info");
  if (!el) return;
  if (!cache) {
    el.textContent = "Noch kein Playlist-Cache geladen.";
    return;
  }
  const ageMin = Math.round((Date.now() - cache.cachedAt) / 60000);
  el.textContent = `${cache.items.length} Songs im Cache (zuletzt aktualisiert: vor ${ageMin} Min.).`;
}

// --- Spotify Web API (Client Credentials flow) — year + exact track link ---
let spotifyTokenCache = { token: null, expiresAt: 0 };

async function getSpotifyToken() {
  if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt - 5000) {
    return spotifyTokenCache.token;
  }
  if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
    throw new Error("missing-spotify-credentials");
  }
  const basic = btoa(`${settings.spotifyClientId}:${settings.spotifyClientSecret}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body: "grant_type=client_credentials"
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    const message = (data && data.error_description) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  spotifyTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return spotifyTokenCache.token;
}

async function lookupTrackViaSpotify(artist, title) {
  const token = await getSpotifyToken();
  const q = `track:${title} artist:${artist}`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) throw new Error("rate-limited");
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const message = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  const items = (data.tracks && data.tracks.items) || [];
  const currentYear = new Date().getFullYear();
  for (const t of items) {
    const releaseDate = t.album && t.album.release_date;
    if (!releaseDate || !t.name || !t.artists || !t.artists.length) continue;
    const year = Number(String(releaseDate).slice(0, 4));
    if (year && year >= 1900 && year <= currentYear) {
      return {
        year: String(year),
        canonicalArtist: t.artists.map((a) => a.name).join(", "),
        canonicalTitle: t.name,
        link: (t.external_urls && t.external_urls.spotify) || `https://open.spotify.com/track/${t.id}`
      };
    }
  }
  return null;
}

function spotifyErrorMessage(err) {
  const msg = (err && err.message) || "";
  if (msg === "missing-spotify-credentials" || !settings.spotifyClientId || !settings.spotifyClientSecret) {
    return "Bitte zuerst Spotify Client-ID und Client-Secret unter „Spotify-Anbindung“ eintragen.";
  }
  if (/invalid_client/i.test(msg)) return "Spotify Client-ID/Secret ungültig — bitte unter „Spotify-Anbindung“ prüfen.";
  if (/rate-limited|429/i.test(msg)) return "Spotify-API gerade ausgelastet (Rate-Limit) — kurz warten und nochmal versuchen.";
  return `Spotify-API-Fehler: ${msg || "unbekannt"}. Internetverbindung & Zugangsdaten prüfen.`;
}

// --- main pipeline: pick random playlist videos, verify+link via Spotify ---
async function generateRandomCards(n) {
  const btn = document.getElementById("random-btn");
  const originalText = btn.textContent;

  if (!settings.ytApiKey) {
    setStatus("Bitte zuerst einen YouTube-API-Key unter „YouTube-Quelle“ eintragen.");
    return;
  }
  if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
    setStatus("Bitte zuerst Spotify Client-ID und Client-Secret unter „Spotify-Anbindung“ eintragen.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Lade Playlist …";

  let pool;
  try {
    pool = await ensurePlaylistCache();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    setStatus(youtubeErrorMessage(err));
    return;
  }

  if (!pool || pool.length === 0) {
    btn.disabled = false;
    btn.textContent = originalText;
    setStatus("Die Playlist enthält keine verwertbaren Songs.");
    return;
  }

  btn.textContent = "Erstelle Karten …";

  const existingKeys = new Set(entries.map((e) => `${e.artist}|${e.title}`.toLowerCase()));
  const titleUsed = new Set(entries.map((e) => e.title.trim().toLowerCase()));
  const order = shuffleArray(pool);
  const picks = [];
  let i = 0;
  let consecutiveErrors = 0;
  let abortedForRateLimit = false;
  let lastError = null;
  const maxConsecutiveErrors = 6;

  while (picks.length < n && i < order.length) {
    const item = order[i++];
    const parsed = parseArtistTitle(item.title);
    if (!parsed) continue; // title wasn't in a parseable "Artist - Title" shape
    if (titleUsed.has(parsed.title.trim().toLowerCase())) continue;

    btn.textContent = `Prüfe „${parsed.title}“ … (${picks.length}/${n})`;

    let meta = null;
    try {
      meta = await lookupTrackViaSpotify(parsed.artist, parsed.title);
      consecutiveErrors = 0; // request actually went through, even if no match
    } catch (err) {
      consecutiveErrors++;
      lastError = err;
    }

    await sleep(200 + Math.random() * 150); // be gentle with the Spotify API

    if (consecutiveErrors >= maxConsecutiveErrors) {
      abortedForRateLimit = true;
      break;
    }
    if (!meta) continue;

    const key = `${meta.canonicalArtist}|${meta.canonicalTitle}`.toLowerCase();
    const titleKey = meta.canonicalTitle.trim().toLowerCase();
    if (existingKeys.has(key) || titleUsed.has(titleKey)) continue;

    existingKeys.add(key);
    titleUsed.add(titleKey);
    picks.push({
      year: meta.year,
      artist: meta.canonicalArtist,
      title: meta.canonicalTitle,
      link: meta.link
    });
  }

  btn.disabled = false;
  btn.textContent = originalText;

  if (picks.length === 0) {
    setStatus(
      abortedForRateLimit
        ? spotifyErrorMessage(lastError)
        : "Keine passenden Songs gefunden — versuch es nochmal oder aktualisiere den Playlist-Cache.",
      abortedForRateLimit
    );
    return;
  }

  picks.forEach((song) => {
    entries.push({
      id: uid(),
      year: song.year,
      artist: song.artist,
      title: song.title,
      link: song.link,
      code: suggestNextCode()
    });
  });

  saveState();
  renderAll();

  if (abortedForRateLimit) {
    setStatus(`${picks.length} von ${n} Karten erstellt — danach hat Spotify nicht mehr reagiert (${spotifyErrorMessage(lastError)}). Kurz warten, dann nochmal klicken für mehr.`, true);
  } else {
    setStatus(
      picks.length < n
        ? `Nur ${picks.length} von ${n} Songs gefunden — einfach nochmal klicken, um mehr zu holen.`
        : `${picks.length} Karten mit echten Spotify-Links erstellt.`
    );
  }
}


/* ============================================================
   INIT
   ============================================================ */
function renderAll() {
  renderEntriesTable();
  renderPages();
}

function init() {
  loadState();

  document.getElementById("card-form").addEventListener("submit", handleFormSubmit);
  document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);
  document.getElementById("entries-body").addEventListener("click", handleTableClick);
  document.getElementById("print-btn").addEventListener("click", () => window.print());
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (entries.length === 0) return;
    if (!confirm("Wirklich ALLE Karten löschen? Das kann nicht rückgängig gemacht werden.")) return;
    entries = [];
    saveState();
    renderAll();
    setStatus("Alle Karten gelöscht.");
  });
  document.getElementById("random-btn").addEventListener("click", () => {
    const n = Math.max(1, Math.min(100, Number(document.getElementById("random-count").value) || 20));
    generateRandomCards(n);
  });
  document.getElementById("export-btn").addEventListener("click", exportJson);
  document.getElementById("import-input").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (file) importJson(file);
    ev.target.value = "";
  });

  bindSettings();
  fillFormDefaults();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
