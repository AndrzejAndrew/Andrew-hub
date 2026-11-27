const appLayout = document.getElementById('app-layout');
const dashboard = document.getElementById('bento-dashboard');
const gameRunner = document.getElementById('game-runner');
const gameIframe = document.getElementById('game-iframe');
const activeGameTitle = document.getElementById('active-game-title');

let newsDataCache = null;
let loadedGamesCache = [];
let isLoggedIn = false;

// 1. Inicjalizacja portalu
async function initHub() {
  initTheme();
  initCli();
  await Promise.all([loadGames(), loadNews()]);
  attachSpotlightEffect();
}

// =========================================================
// SKÓRKI (MOTYWY) I LINIA KOMEND (CLI)
// =========================================================
function setTheme(themeName) {
  const allowed = ['default', 'dark', 'light', 'terminal'];
  const chosen = allowed.includes(themeName) ? themeName : 'default';
  document.body.setAttribute('data-theme', chosen);
  localStorage.setItem('andrew_hub_theme', chosen);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === chosen);
  });

  const topSelect = document.getElementById('topbar-theme-select');
  if (topSelect && topSelect.value !== chosen) {
    topSelect.value = chosen;
  }

  const cliBar = document.getElementById('cli-bar');
  if (cliBar && chosen === 'terminal') {
    cliBar.classList.remove('hidden');
  }
}

function initTheme() {
  const saved = localStorage.getItem('andrew_hub_theme') || 'default';
  setTheme(saved);
}

function toggleCliBar() {
  const cliBar = document.getElementById('cli-bar');
  if (!cliBar) return;
  cliBar.classList.toggle('hidden');
  if (!cliBar.classList.contains('hidden')) {
    document.getElementById('cli-input')?.focus();
  }
}

function cliPrint(text) {
  const out = document.getElementById('cli-output');
  if (!out) return;
  out.textContent += (out.textContent ? '\n' : '') + text;
  out.scrollTop = out.scrollHeight;
}

function executeCliCommand(rawCmd) {
  const trimmed = rawCmd.trim();
  if (!trimmed) return;
  cliPrint(`andrzej@hub:~$ ${trimmed}`);

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ').toLowerCase();

  if (cmd === 'help') {
    cliPrint('Komendy:\n  ls                                  - lista gier i projektów\n  play <nazwa/id>                     - uruchom grę\n  theme <default|dark|light|terminal> - zmień skórkę\n  filter <all|strategy|arcade|news>   - filtruj kafelki\n  close                               - zamknij grę\n  clear                               - wyczyść konsolę');
    return;
  }

  if (cmd === 'clear') {
    const out = document.getElementById('cli-output');
    if (out) out.textContent = '';
    return;
  }

  if (cmd === 'ls') {
    if (!loadedGamesCache.length) {
      cliPrint('Brak załadowanych gier.');
      return;
    }
    const list = loadedGamesCache.map(g => `  [${g.id}] ${g.title} (${g.newTab ? 'nowa karta' : g.mode})`).join('\n');
    cliPrint('Moduły:\n' + list);
    return;
  }

  if (cmd === 'theme') {
    if (!['default', 'dark', 'light', 'terminal'].includes(arg)) {
      cliPrint('Użycie: theme default | dark | light | terminal');
      return;
    }
    setTheme(arg);
    cliPrint(`Motyw: ${arg}`);
    return;
  }

  if (cmd === 'filter') {
    const btn = document.querySelector(`.nav-btn[data-filter="${arg}"]`);
    if (btn) {
      btn.click();
      cliPrint(`Filtr: ${arg}`);
    } else {
      cliPrint('Użycie: filter all | strategy | arcade | news');
    }
    return;
  }

  if (cmd === 'close') {
    closeGame();
    cliPrint('Zamknięto grę.');
    return;
  }

  if (cmd === 'play' || cmd === 'run' || cmd === 'open') {
    if (!arg) {
      cliPrint('Podaj nazwę lub ID, np. "play evolve".');
      return;
    }
    const found = loadedGamesCache.find(g =>
      g.id.toLowerCase() === arg ||
      g.title.toLowerCase().includes(arg) ||
      g.id.toLowerCase().includes(arg)
    );
    if (!found) {
      cliPrint(`Nie znaleziono: "${arg}". Wpisz "ls".`);
      return;
    }
    const isExternal = Boolean(found.newTab || found.mode === 'newtab' || /^https?:\/\//i.test(found.url));
    cliPrint(`Otwieranie: ${found.title}...`);
    launchGame(found.title, found.url, found.mode, isExternal);
    return;
  }

  cliPrint(`Nieznana komenda: "${cmd}". Wpisz "help".`);
}

function initCli() {
  const cliInput = document.getElementById('cli-input');
  if (cliInput) {
    cliInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = cliInput.value;
        cliInput.value = '';
        executeCliCommand(val);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '`' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName))) {
      e.preventDefault();
      toggleCliBar();
    }
  });
}

// 2. Dynamiczne renderowanie kafelków gier z data/games.json
async function loadGames() {
  try {
    const res = await fetch('./data/games.json?t=' + Date.now());
    if (!res.ok) return;
    const rawGames = await res.json();
    if (!Array.isArray(rawGames) || !rawGames.length) return;

    document.querySelectorAll('.bento-item[data-type="game"]').forEach(el => el.remove());

    const seen = new Set();
    const games = rawGames.filter(g => {
      const key = g.id || g.url || g.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    loadedGamesCache = games;

    const securityCard = document.querySelector('.card-feed');

    games.forEach((game, index) => {
      const article = document.createElement('article');
      article.className = `bento-item ${game.span || 'span-1x1'} ${game.featured ? 'card-featured' : ''}`;
      article.dataset.category = game.category || 'arcade';
      article.dataset.type = 'game';

      const isExternalNewTab = Boolean(game.newTab || game.mode === 'newtab' || /^https?:\/\//i.test(game.url));
      const modeLabel = isExternalNewTab ? 'Nowa Karta ↗' : (game.mode === 'fullscreen' ? 'Pełny Ekran' : 'Widok z Menu');
      const btnHtml = game.featured
        ? `<button class="btn-launch" onclick="launchGame('${game.title}', '${game.url}', '${game.mode}', ${isExternalNewTab})">Uruchom ${game.title} ${isExternalNewTab ? '↗' : '→'}</button>`
        : `<button class="btn-launch-sm" onclick="launchGame('${game.title}', '${game.url}', '${game.mode}', ${isExternalNewTab})">${isExternalNewTab ? 'Otwórz ↗' : 'Graj'}</button>`;

      article.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-top">
          <span class="tag tag-${game.tagColor || 'cyan'}">${game.tag || 'Gra'}</span>
          <span class="tag tag-outline">${modeLabel}</span>
        </div>
        <div class="card-body">
          <h3>${game.title}</h3>
          <p>${game.description || ''}</p>
        </div>
        <div class="card-actions">${btnHtml}</div>
      `;

      if (index === 0 && securityCard) {
        dashboard.insertBefore(article, securityCard);
      } else {
        dashboard.appendChild(article);
      }
    });
  } catch (err) {
    console.warn('Używam domyślnych kafelków z HTML:', err);
  }
}

function uniqueNewsItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter(item => {
    const key = (item.link && item.link !== '#') ? item.link : `${item.source}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 3. Ładowanie newsów z data/news.json
async function loadNews() {
  try {
    const res = await fetch('./data/news.json?t=' + Date.now());
    if (!res.ok) return;
    const parsed = await res.json();
    if (!parsed || typeof parsed !== 'object') return;
    newsDataCache = parsed;

    const secFeed = document.getElementById('security-feed');
    const secItems = uniqueNewsItems(newsDataCache.security);
    if (secFeed && secItems.length) {
      secFeed.innerHTML = secItems.map(item => `
        <li>
          <span class="source-badge ${item.badge || 'sec'}">${item.source || 'Info'}</span>
          <a href="${item.link || '#'}" target="_blank" rel="noopener">${item.title || 'Bez tytułu'}</a>
          <time>${item.date || ''}</time>
        </li>
      `).join('');
    }

    const itGamesFeed = document.getElementById('it-games-feed');
    const itGamesItems = uniqueNewsItems(newsDataCache.it_games);
    if (itGamesFeed && itGamesItems.length) {
      itGamesFeed.innerHTML = itGamesItems.map(item => `
        <li>
          <span class="source-badge ${item.badge || 'sec'}">${item.source || 'Info'}</span>
          <a href="${item.link || '#'}" target="_blank" rel="noopener">${item.title || 'Bez tytułu'}</a>
          <time>${item.date || ''}</time>
        </li>
      `).join('');
    } else if (itGamesFeed) {
      itGamesFeed.innerHTML = `
        <li>
          <span class="source-badge sec">Info</span>
          <a href="#" onclick="return false;">Brak wpisów IT & Gry — uruchom workflow prasówki, aby pobrać świeże newsy.</a>
          <time>--:--</time>
        </li>
      `;
    }

    renderLeclercFeed();
  } catch (err) {
    console.warn('Brak pliku data/news.json:', err);
  }
}

function renderLeclercFeed() {
  const leclercContent = document.getElementById('leclerc-feed-content');
  if (!leclercContent) return;

  if (!isLoggedIn) {
    leclercContent.innerHTML = `<p class="locked-placeholder">Zaloguj się na swoje konto, aby odblokować automatyczny raport wzmianek z polskich mediów oraz tablice wyników zespołu.</p>`;
    return;
  }

  const leclercItems = uniqueNewsItems(newsDataCache?.leclerc);
  if (leclercItems.length) {
    leclercContent.innerHTML = `
      <ul class="news-list">
        ${leclercItems.map(item => `
          <li>
            <span class="source-badge ${item.badge || 'sec'}">${item.source || 'Info'}</span>
            <a href="${item.link || '#'}" target="_blank" rel="noopener">${item.title || 'Bez tytułu'}</a>
            <time>${item.date || ''}</time>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    leclercContent.innerHTML = `<p class="locked-placeholder">Brak nowych artykułów w pliku data/news.json.</p>`;
  }
}

// 4. Uruchamianie gier (zewnętrzne zawsze w nowej karcie, lokalne w ramce)
function launchGame(title, url, mode = 'sidebar', newTab = false) {
  const isExternal = Boolean(newTab || mode === 'newtab' || /^https?:\/\//i.test(url));
  if (isExternal) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  dashboard.classList.add('hidden');
  gameRunner.classList.remove('hidden');
  activeGameTitle.textContent = title;
  gameIframe.src = url;

  if (mode === 'fullscreen') {
    appLayout.classList.add('fullscreen-mode');
  } else {
    appLayout.classList.remove('fullscreen-mode');
  }
}

function closeGame() {
  gameIframe.src = 'about:blank';
  gameRunner.classList.add('hidden');
  dashboard.classList.remove('hidden');
  appLayout.classList.remove('fullscreen-mode');
}

function toggleFullscreenMode() {
  appLayout.classList.toggle('fullscreen-mode');
}

// 5. Filtrowanie kafelków
document.querySelectorAll('.nav-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    closeGame();

    document.querySelectorAll('.bento-item').forEach(item => {
      if (filter === 'all' || item.dataset.category === filter) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
});

// =========================================================
// 6. AUTORYZACJA SUPABASE
// =========================================================
const SUPABASE_URL = 'https://wtgibsqcxwkylhsfidgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Xa3OHOsKSa0_ZTJiHRY45A_fpUfBgpp';

if (!window.dbClient) {
  window.dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

const authModal = document.getElementById('auth-modal');
const btnSubmitAuth = document.getElementById('btn-submit-auth');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const switchMode = document.getElementById('switch-to-register');
const modalTitle = document.getElementById('modal-title');
const switchText = document.getElementById('switch-text');
const btnAuth = document.getElementById('btn-auth');

let isRegisterMode = false;

btnAuth.addEventListener('click', async () => {
  if (isLoggedIn) {
    await window.dbClient.auth.signOut();
  } else {
    authModal.classList.remove('hidden');
  }
});

document.getElementById('close-modal').addEventListener('click', () => {
  authModal.classList.add('hidden');
});

switchMode.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  modalTitle.textContent = isRegisterMode ? 'Rejestracja w Nexusie' : 'Logowanie do Nexusa';
  btnSubmitAuth.textContent = isRegisterMode ? 'Załóż konto' : 'Zaloguj się';
  switchText.textContent = isRegisterMode ? 'Masz już konto?' : 'Nie masz konta?';
  switchMode.textContent = isRegisterMode ? 'Zaloguj się' : 'Zarejestruj się';
  authError.classList.add('hidden');
});

btnSubmitAuth.addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPassword.value;

  if (!email || !password) {
    showAuthMsg('Wypełnij oba pola.', false);
    return;
  }

  btnSubmitAuth.textContent = "Przetwarzanie...";

  if (isRegisterMode) {
    const { data, error } = await window.dbClient.auth.signUp({ email, password });
    if (error) {
      showAuthMsg('Błąd: ' + error.message, false);
    } else {
      showAuthMsg('Konto założone! Poczekaj na weryfikację i akceptację administratora.', true);
      authEmail.value = '';
      authPassword.value = '';
    }
  } else {
    const { data, error } = await window.dbClient.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthMsg('Błąd logowania. Sprawdź dane lub zapytaj admina o akceptację konta.', false);
    } else {
      authModal.classList.add('hidden');
      authEmail.value = '';
      authPassword.value = '';
    }
  }
  btnSubmitAuth.textContent = isRegisterMode ? 'Załóż konto' : 'Zaloguj się';
});

function showAuthMsg(msg, isSuccess) {
  authError.textContent = msg;
  authError.className = `error-msg ${isSuccess ? 'success-msg' : ''}`;
  authError.classList.remove('hidden');
}

window.dbClient.auth.onAuthStateChange((event, session) => {
  isLoggedIn = !!session;

  if (isLoggedIn) {
    const email = session.user.email;
    const name = email.split('@')[0];

    document.getElementById('user-name').textContent = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById('user-role').textContent = 'Zweryfikowany członek IT';
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    btnAuth.textContent = 'Wyloguj';
    document.getElementById('lock-indicator').textContent = '🔓 Odblokowano';
  } else {
    document.getElementById('user-name').textContent = 'Tryb Gościa';
    document.getElementById('user-role').textContent = 'Tylko publiczne moduły';
    document.getElementById('user-avatar').textContent = '?';
    btnAuth.textContent = 'Zaloguj się';
    document.getElementById('lock-indicator').textContent = '🔒 Wymagane logowanie';
  }

  renderLeclercFeed();
});

// =========================================================
// 7. Reflektor myszy na kafelkach
// =========================================================
function attachSpotlightEffect() {
  dashboard.addEventListener('mousemove', e => {
    const card = e.target.closest('.bento-item');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  });
}

// =========================================================
// 8. Zegar
// =========================================================
function updateClock() {
  document.getElementById('clock-widget').textContent = new Date().toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

initHub();

// =========================================================
// 9. GLOBALNY ZAPIS WYNIKÓW GIER DO SUPABASE (TYLKO ZALOGOWANI)
// =========================================================
window.saveGameScore = async function(gameId, mode, result, score, meta = {}) {
  try {
    const { data: { session } } = await window.dbClient.auth.getSession();
    if (!session || !session.user) {
      return { ok: false, reason: 'not_logged_in' };
    }
    const email = session.user.email || 'gracz@hub';
    const base = email.split('@')[0];
    const nick = base.charAt(0).toUpperCase() + base.slice(1);

    const { error } = await window.dbClient.from('game_results').insert([{
      user_id: session.user.id,
      nick,
      game_id: gameId,
      mode,
      result,
      score: Math.max(0, Math.round(Number(score) || 0)),
      meta
    }]);

    if (error) {
      console.warn('Błąd zapisu wyniku:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.warn('Wyjątek zapisu wyniku:', err);
    return { ok: false };
  }
};
