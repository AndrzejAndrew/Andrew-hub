const appLayout = document.getElementById('app-layout');
const dashboard = document.getElementById('bento-dashboard');
const gameRunner = document.getElementById('game-runner');
const gameIframe = document.getElementById('game-iframe');
const activeGameTitle = document.getElementById('active-game-title');

let newsDataCache = null;
let isLoggedIn = false;

// 1. Inicjalizacja portalu (wczytanie gier i newsów z JSON)
async function initHub() {
  await Promise.all([loadGames(), loadNews()]);
  attachSpotlightEffect();
}

// 2. Dynamiczne renderowanie kafelków gier z data/games.json
async function loadGames() {
  try {
    const res = await fetch('./data/games.json?t=' + Date.now());
    if (!res.ok) return;
    const rawGames = await res.json();

    // Usuwamy stare kafelki gier przed ponownym wyrenderowaniem
    document.querySelectorAll('.bento-item[data-type="game"]').forEach(el => el.remove());

    // Deduplikacja gier po id lub url
    const seen = new Set();
    const games = rawGames.filter(g => {
      const key = g.id || g.url || g.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const securityCard = document.querySelector('.card-feed');

    games.forEach((game, index) => {
      const article = document.createElement('article');
      article.className = `bento-item ${game.span} ${game.featured ? 'card-featured' : ''}`;
      article.dataset.category = game.category;
      article.dataset.type = 'game';

      const modeLabel = game.mode === 'fullscreen' ? 'Pełny Ekran' : 'Widok z Menu';
      const btnHtml = game.featured
        ? `<button class="btn-launch" onclick="launchGame('${game.title}', '${game.url}', '${game.mode}')">Uruchom ${game.title} →</button>`
        : `<button class="btn-launch-sm" onclick="launchGame('${game.title}', '${game.url}', '${game.mode}')">Graj</button>`;

      article.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-top">
          <span class="tag tag-${game.tagColor}">${game.tag}</span>
          <span class="tag tag-outline">${modeLabel}</span>
        </div>
        <div class="card-body">
          <h3>${game.title}</h3>
          <p>${game.description}</p>
        </div>
        <div class="card-actions">${btnHtml}</div>
      `;

      // Pierwszy kafelek (Fabryka) wstawiamy przed prasówką, resztę po niej
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

// Pomocnik do usuwania duplikatów artykułów
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

// 3. Ładowanie prawdziwych newsów z data/news.json
async function loadNews() {
  try {
    const res = await fetch('./data/news.json?t=' + Date.now());
    if (!res.ok) return;
    newsDataCache = await res.json();

    const secFeed = document.getElementById('security-feed');
    const secItems = uniqueNewsItems(newsDataCache.security);
    if (secFeed && secItems.length) {
      secFeed.innerHTML = secItems.map(item => `
        <li>
          <span class="source-badge ${item.badge}">${item.source}</span>
          <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
          <time>${item.date}</time>
        </li>
      `).join('');
    }
    renderLeclercFeed();
  } catch (err) {
    console.warn('Brak pliku data/news.json – czekam na pierwszy run skryptu:', err);
  }
}

function renderLeclercFeed() {
  const leclercContent = document.getElementById('leclerc-feed-content');
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
            <span class="source-badge ${item.badge}">${item.source}</span>
            <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
            <time>${item.date}</time>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    leclercContent.innerHTML = `<p class="locked-placeholder">Brak nowych artykułów w pliku data/news.json. Uruchom akcję na GitHubie.</p>`;
  }
}

// 4. Uruchamianie i zamykanie gier
function launchGame(title, url, mode = 'sidebar') {
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
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
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
// 6. AUTORYZACJA SUPABASE (Prawdziwe Logowanie i Rejestracja)
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
// 7. Reflektor myszy na kafelkach (delegacja zdarzeń dla dynamicznych kart)
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
