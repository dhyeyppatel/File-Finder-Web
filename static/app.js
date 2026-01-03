/* app.js - updated
   - keeps search/suggestions, infinite scroll, dark-mode
   - adds overlay + robust open/close for sidebar (mobile friendly)
   - ensures close button visible and adds auto-close (8s) with interaction cancel
*/

const API_BASE = ""; // same origin
const cardsEl = document.getElementById('cards');
const loadingEl = document.getElementById('loading');
const endEl = document.getElementById('endOfList');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsEl = document.getElementById('suggestions');

let page = 1;
const per_page = 20;
let loading = false;
let finished = false;
let currentQuery = "";
let currentYear = "";
let currentType = "";
let currentSort = "desc";

// Sidebar auto-close timer handle
let sidebarAutoCloseTimer = null;
const SIDEBAR_AUTO_CLOSE_MS = 3000; // 3 seconds

// --- helpers ---
const debounce = (fn, delay = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
};

// Syntax Parser: extracts year:2024 type:pdf from query
// Syntax Parser Removed as per request (buggy)
function parseSyntax(rawQuery) {
  // simple pass-through now, logic removed.
  return { q: rawQuery, year: currentYear, type: currentType };
}

// --- History Logic ---
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
  } catch { return []; }
}
function addToHistory(term) {
  if (!term) return;
  let hist = getHistory();
  // Remove if exists (to move to top)
  hist = hist.filter(h => h.toLowerCase() !== term.toLowerCase());
  hist.unshift(term);
  if (hist.length > 5) hist.pop(); // keep top 5
  localStorage.setItem('searchHistory', JSON.stringify(hist));
}

function _parseParams() {
  const p = new URLSearchParams();
  p.set('page', page);
  p.set('per_page', per_page);

  // Apply advanced syntax parsing
  const { q, year, type } = parseSyntax(currentQuery);

  if (q) p.set('q', q);
  if (year) p.set('year', year);
  if (type) p.set('type', type);
  if (currentSort) p.set('sort', currentSort);
  return p;
}

function mkTextEllipses(text, max = 120) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function getFileTypeFromName(name) {
  if (!name) return 'unknown';
  const m = name.match(/\.([a-zA-Z0-9]{1,5})$/);
  if (m && m[1]) return m[1].toLowerCase();
  const lower = name.toLowerCase();
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('mkv')) return 'mkv';
  if (lower.includes('zip')) return 'zip';
  return 'unknown';
}

// Levenshtein distance for fuzzy suggestions
function levenshtein(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// --- UI actions ---
document.getElementById('searchBtn').addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
searchInput.addEventListener('input', debounce(onSearchInput, 220));
// Show history on focus if empty
searchInput.addEventListener('focus', () => {
  if (!searchInput.value.trim()) showHistorySuggestions();
});

/* Keep the filter change handlers intact (logic still runs),
   but visually hide the .controls section so it doesn't show in the UI. */
const yearSel = document.getElementById('yearFilter');
const typeSel = document.getElementById('typeFilter');
const sortSel = document.getElementById('sortFilter');
if (yearSel) yearSel.addEventListener('change', () => { currentYear = yearSel.value; resetAndLoad(); });
if (typeSel) typeSel.addEventListener('change', () => { currentType = typeSel.value; resetAndLoad(); });
if (sortSel) sortSel.addEventListener('change', () => { currentSort = sortSel.value; resetAndLoad(); });

document.getElementById('refreshBtn').addEventListener('click', () => { resetAndLoad(); closeSidebar(); });
document.getElementById('featuresBtn').addEventListener('click', () => { openModal(featuresHtml()); closeSidebar(); });
document.getElementById('howtoBtn').addEventListener('click', () => { openModal(howtoHtml()); closeSidebar(); });

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const overlay = document.getElementById('overlay');
// Make sure we read the correct id
const sidebarCloseBtn = document.getElementById('sidebarClose');

// Ensure overlay click closes sidebar
if (overlay) overlay.addEventListener('click', closeSidebar);
// sidebar close button
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);

// prevent clicks inside sidebar from closing it (stop propagation)
if (sidebar) {
  sidebar.addEventListener('click', (e) => {
    e.stopPropagation();
    // if the user interacts with sidebar, cancel the auto-close timer
    cancelSidebarAutoClose();
  });
  // any pointer interaction cancels auto-close
  sidebar.addEventListener('pointerdown', () => cancelSidebarAutoClose());
}

// toggle via hamburger
openSidebarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (sidebar.classList.contains('open')) closeSidebar();
  else openSidebar();
});

// close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // if modal open, close that first
    const modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    } else {
      closeSidebar();
    }
  }
});

// close sidebar when clicking outside (document)
document.addEventListener('click', (e) => {
  const clickedHamburger = e.target.closest('#openSidebarBtn');
  const insideSidebar = e.target.closest('#sidebar');
  if (!insideSidebar && !clickedHamburger) {
    // click outside -> close
    closeSidebar();
  }
});

// helpers
function lockBodyScroll(lock) {
  if (lock) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}
function openSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  sidebar.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  lockBodyScroll(true);
  startSidebarAutoClose();
}
function closeSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  sidebar.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  lockBodyScroll(false);
  cancelSidebarAutoClose();
}

function startSidebarAutoClose() {
  cancelSidebarAutoClose();
  // start timer to auto-close after a short period to avoid stuck-in-between states
  sidebarAutoCloseTimer = setTimeout(() => {
    // only close if still open and user isn't focusing inside it
    if (sidebar && sidebar.classList.contains('open')) closeSidebar();
  }, SIDEBAR_AUTO_CLOSE_MS);
}
function cancelSidebarAutoClose() {
  if (sidebarAutoCloseTimer) {
    clearTimeout(sidebarAutoCloseTimer);
    sidebarAutoCloseTimer = null;
  }
}

// Modal logic
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModal');
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function openModal(html) { if (modal) { modal.classList.remove('hidden'); modalBody.innerHTML = html; } }
function closeModal() { if (modal) { modal.classList.add('hidden'); modalBody.innerHTML = ""; } }
function featuresHtml() {
  return `
    <h2>Features</h2>
    <ul style="line-height:1.6">
      <li><strong>Smart Search</strong>: Auto-suggestions, history, and fuzzy matching.</li>
      <li><strong>Modern UI</strong>: Glassmorphism, Dynamic Themes, and Dark Mode.</li>
      <li><strong>Shortcuts</strong>: Press <code>/</code> to focus search instantly.</li>
    </ul>`;
}

function howtoHtml() {
  return `
    <h2>How to use</h2>
    <ol style="line-height:1.6">
      <li><strong>Search</strong>: Type a media or file/document name (e.g. "Deforestation").</li>
      <li><strong>Filter</strong>: Use dropdowns (Year/Type) if enabled.</li>
      <li><strong>Get Link</strong>: Click <strong>Send</strong> to open in Telegram, or <strong>Copy</strong> to grab the link.</li>
      <li><strong>History</strong>: Click the empty search bar to see recent searches.</li>
      <li><strong>Upload</strong>: Use the Sidebar > Upload option to contribute files.</li>
    </ol>`;
}

// --- suggestions logic ---
async function onSearchInput(e) {
  const q = e.target.value.trim();
  if (!q) {
    // Show history if empty
    showHistorySuggestions();

    // when user erases search, show home/latest
    currentQuery = "";
    resetAndLoad();
    return;
  }
  await showSuggestions(q);
}

function showHistorySuggestions() {
  const hist = getHistory();
  if (hist.length === 0) { hideSuggestions(); return; }

  suggestionsEl.innerHTML = `<div style="padding:8px 12px; font-size:11px; color:var(--text-muted); font-weight:600; background:rgba(0,0,0,0.02)">RECENT SEARCHES</div>` +
    hist.map(t => {
      return `<div class="suggestion-item history-item">🕒 ${escapeHtml(t)}</div>`;
    }).join('');
  suggestionsEl.style.display = 'block';

  Array.from(suggestionsEl.querySelectorAll('.suggestion-item.history-item')).forEach(el => {
    el.addEventListener('click', () => {
      const title = el.textContent.replace('🕒 ', '') || '';
      searchInput.value = title;
      hideSuggestions();
      doSearch();
    });
  });
}

async function showSuggestions(q) {
  try {
    const term = q.trim().toLowerCase();

    // 1. Fetch small batch of direct matches
    let res = await fetch(`/api/search?q=${encodeURIComponent(q)}&per_page=8`);

    // 2. Fetch wider pool for smart fuzzy/substring matching if needed
    if (res.ok) {
      let data = await res.json();
      let items = data.items || [];

      if (items.length < 5) {
        // get more items to perform client-side smart filtering
        const res2 = await fetch(`/api/search?per_page=300`);
        if (res2.ok) {
          const data2 = await res2.json();
          const pool = data2.items || [];

          // Score items:
          // - Contains substring? High score
          // - Levenshtein distance? Low score
          const scored = pool.map(it => {
            const name = (it.file_name || "").toLowerCase();
            if (name.includes(term)) return { it, score: 0 }; // best match
            return { it, score: levenshtein(term, name) };
          });

          // Sort by score (lower is better)
          scored.sort((a, b) => a.score - b.score);

          // Take top matches (substrings will be at top, then close fuzzy matches)
          items = scored.slice(0, 10).map(s => s.it);
        }
      }
      renderSuggestions(items.slice(0, 8));
    }
  } catch (err) {
    console.error('suggest err', err);
    hideSuggestions();
  }
}

function renderSuggestions(items) {
  if (!items || items.length === 0) { hideSuggestions(); return; }
  suggestionsEl.innerHTML = items.map(it => {
    const title = it.file_name || '(no name)';
    return `<div class="suggestion-item" data-id="${encodeURIComponent(it.id)}">${escapeHtml(title)}</div>`;
  }).join('');
  suggestionsEl.style.display = 'block';

  Array.from(suggestionsEl.querySelectorAll('.suggestion-item')).forEach(el => {
    el.addEventListener('click', () => {
      const title = el.textContent || '';
      searchInput.value = title;
      hideSuggestions();
      doSearch();
      // auto-close sidebar (if open) when user selects a suggestion
      closeSidebar();
    });
  });
}

function hideSuggestions() { if (suggestionsEl) { suggestionsEl.style.display = 'none'; suggestionsEl.innerHTML = ''; } }

function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// hide suggestions when clicking outside search area or suggestions
document.addEventListener('click', (e) => {
  const inside = e.target.closest('.search-area') || e.target.closest('.suggestions');
  if (!inside) hideSuggestions();
});

// --- search & infinite scroll ---
let lastRenderedYear = null; // Track year for grouping

function doSearch() {
  currentQuery = searchInput.value.trim();
  addToHistory(currentQuery); // SAVE HISTORY
  page = 1;
  finished = false;
  lastRenderedYear = null; // Reset
  cardsEl.innerHTML = "";
  endEl.style.display = 'none';
  loadNext();
  // close sidebar when searching (clean UX)
  closeSidebar();
}

function resetAndLoad() {
  page = 1;
  finished = false;
  lastRenderedYear = null; // Reset
  cardsEl.innerHTML = "";
  endEl.style.display = 'none';
  loadNext();
}

// Hide the visual controls area if present (user asked to remove it from UI).
// Code handling for filters still runs above, so you can re-enable UI later if needed.
const controlsEl = document.querySelector('.controls');
if (controlsEl) {
  controlsEl.style.display = 'none';
}

// infinite scroll
window.addEventListener('scroll', () => {
  if (loading || finished) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 420) {
    loadNext();
  }
});

async function loadNext() {
  if (loading || finished) return;
  loading = true;
  loadingEl.style.display = 'block';

  try {
    const params = _parseParams();
    // always use /api/search so sorting/filters are respected by backend logic (even if UI hidden)
    const url = `/api/search?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('network');
    const data = await res.json();
    const items = data.items || [];

    if (page === 1 && items.length === 0) {
      cardsEl.innerHTML = `
        <div style="text-align:center; padding:40px; opacity:0.7;">
          <div style="font-size:48px; margin-bottom:12px">🍃</div>
          <h3>No results found</h3>
          <p>Try fewer keywords, or different spellings.</p>
        </div>
      `;
      finished = true;
      endEl.style.display = 'block';
      return;
    }

    items.forEach(makeCard);

    if (items.length < per_page) {
      finished = true;
      endEl.style.display = 'block';
    } else {
      page += 1;
    }
  } catch (err) {
    console.error('load err', err);
  } finally {
    loading = false;
    loadingEl.style.display = 'none';
  }
}

function makeCard(item) {
  // Year Divider Logic
  // Only show divider if looking at SEARCH results (where we sort by year).
  // In Home Feed, we sort by ID, so years are mixed (don't group there).
  if (currentQuery && item.year && item.year !== lastRenderedYear) {
    const divider = document.createElement('div');
    divider.className = 'year-divider';
    divider.textContent = item.year;
    cardsEl.appendChild(divider);
    lastRenderedYear = item.year;
  }

  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h4');
  title.textContent = item.file_name || 'Unnamed file';

  const caption = document.createElement('p');
  caption.textContent = mkTextEllipses(item.caption || '', 140);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const ftype = item.file_type || getFileTypeFromName(item.file_name || '');
  meta.innerHTML = `<span>${ftype}</span><span>${item.year || ''}</span>`;

  const actions = document.createElement('div');
  actions.className = 'actions';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn btn-send';
  sendBtn.textContent = 'Send';
  sendBtn.style.flex = "2";
  sendBtn.addEventListener('click', () => {
    const telegramLink = `https://t.me/dhyeyautofilterbot?start=file_1123135015_${encodeURIComponent(item.id)}`;
    window.open(telegramLink, '_blank');
    // close sidebar on send to keep UX consistent
    closeSidebar();
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-outline';
  copyBtn.textContent = 'Copy';
  copyBtn.style.flex = "1";
  copyBtn.addEventListener('click', async () => {
    try {
      const telegramLink = `https://t.me/dhyeyautofilterbot?start=file_1123135015_${encodeURIComponent(item.id)}`;
      await navigator.clipboard.writeText(telegramLink);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => copyBtn.textContent = originalText, 2000);
    } catch (e) { console.error(e); }
  });

  actions.appendChild(sendBtn);
  actions.appendChild(copyBtn);

  card.appendChild(title);
  card.appendChild(caption);
  card.appendChild(meta);
  card.appendChild(actions);
  cardsEl.appendChild(card);
}

// initial load
resetAndLoad();

// --- Dark mode toggle (persist) ---
const darkToggle = document.getElementById('darkToggle');
function applyDarkMode(enable) {
  if (enable) document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  localStorage.setItem('darkMode', enable ? '1' : '0');
}
if (darkToggle) darkToggle.addEventListener('change', () => applyDarkMode(darkToggle.checked));

// init from storage
const stored = localStorage.getItem('darkMode');
if (stored === '1') { if (darkToggle) darkToggle.checked = true; applyDarkMode(true); } else { if (darkToggle) darkToggle.checked = false; applyDarkMode(false); }

// --- Dynamic Theme Logic ---
const themeDots = document.querySelectorAll('.theme-dot');
const savedTheme = localStorage.getItem('theme') || 'default';

function setTheme(themeName) {
  // Reset all dots
  themeDots.forEach(dot => dot.classList.remove('active'));

  // Activate current dot
  const dotToActive = document.querySelector(`.theme-dot[data-theme="${themeName}"]`);
  if (dotToActive) dotToActive.classList.add('active');

  // Apply theme attribute to body
  if (themeName === 'default') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', themeName);
  }

  // Save preference
  localStorage.setItem('theme', themeName);
}

// Init theme
setTheme(savedTheme);

// Event listeners
themeDots.forEach(dot => {
  dot.addEventListener('click', () => {
    const theme = dot.getAttribute('data-theme');
    setTheme(theme);
  });
});

// --- Phase 2: Dynamic Stats & Shortcuts ---

// 1. Fetch stats and update placeholder
async function updateStats() {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      const count = data.total_files || 0;
      if (count > 0) {
        // Format: "Search among 250,300+ files..."
        const formatted = new Intl.NumberFormat('en-IN').format(count);
        if (searchInput) {
          searchInput.placeholder = `Search among ${formatted}+ files...`;
        }
      }
    }
  } catch (e) {
    console.error('Stats fetch failed', e);
  }
}
updateStats();

// 2. Keyboard Shortcut ('/')
document.addEventListener('keydown', (e) => {
  // If user presses '/' and is NOT already in an input/textarea
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      // Optional: select all text if they want to replace previous query immediately
      // searchInput.select();
    }
  }
});
