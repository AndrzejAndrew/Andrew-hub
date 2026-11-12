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
    const res = await fetch('./data/games.json');
    if (!res.ok) return;
    const games = await res.json();

    // Usuwamy stare statyczne kafelki gier (zostawiamy tylko kafelki z newsami)
    document.querySelectorAll('.bento-item[data-type="game"]').forEach(el => el.remove());

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

// 3. Ładowanie prawdziwych newsów z data/news.json
async function loadNews() {
  try {
    const res = await fetch('./data/news.json?t=' + Date.now());
    if (!res.ok) return;
    newsDataCache = await res.json();

    const secFeed = document.getElementById('security-feed');
    if (secFeed && newsDataCache.security?.length) {
      secFeed.innerHTML = newsDataCache.security.map(item => `
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

  if (newsDataCache && newsDataCache.leclerc?.length) {
    leclercContent.innerHTML = `
      <ul class="news-list">
        ${newsDataCache.leclerc.map(item => `
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

// 6. Przełącznik logowania (tymczasowy przed podpięciem Supabase)
const btnAuth = document.getElementById('btn-auth');
btnAuth.addEventListener('click', () => {
  isLoggedIn = !isLoggedIn;
  document.getElementById('user-name').textContent = isLoggedIn ? 'Andrzej' : 'Tryb Gościa';
  document.getElementById('user-role').textContent = isLoggedIn ? 'Administrator // Zespół IT' : 'Tylko publiczne moduły';
  document.getElementById('user-avatar').textContent = isLoggedIn ? 'A' : '?';
  btnAuth.textContent = isLoggedIn ? 'Wyloguj' : 'Zaloguj się';
  document.getElementById('lock-indicator').textContent = isLoggedIn ? '🔓 Odblokowano' : '🔒 Wymagane logowanie';
  renderLeclercFeed();
});

// 7. Reflektor myszy na kafelkach
function attachSpotlightEffect() {
  document.querySelectorAll('.bento-item').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
}

// 8. Zegar
function updateClock() {
  document.getElementById('clock-widget').textContent = new Date().toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

initHub();
