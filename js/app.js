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
    const list = loadedGamesCache.map(g => `  [${g.id}]${g.title} (${g.newTab ? 'nowa karta' : g.mode})`).join('\n'); cliPrint('Moduły:\n' + list); return; }  if (cmd === 'theme') { if (!['default', 'dark', 'light', 'terminal'].includes(arg)) { cliPrint('Użycie: theme default \vert{} dark \vert{} light \vert{} terminal'); return; } setTheme(arg); cliPrint(`Motyw: ${arg}`);
    return;
  }

  if (cmd === 'filter') {
    const btn = document.querySelector(`.nav-btn[data-filter="${arg}"]`); if (btn) { btn.click(); cliPrint(`Filtr: ${arg}`);
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
      cliPrint(`Nie znaleziono: "${arg}". Wpisz "ls".`); return; } const isExternal = Boolean(found.newTab \vert{}\vert{} found.mode === 'newtab' \vert{}\vert{} /^https?:\/\//i.test(found.url)); cliPrint(`Otwieranie: ${found.title}...`);
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
