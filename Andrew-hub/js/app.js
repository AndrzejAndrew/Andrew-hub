const appLayout = document.getElementById('app-layout');
const dashboard = document.getElementById('bento-dashboard');
const gameRunner = document.getElementById('game-runner');
const gameIframe = document.getElementById('game-iframe');
const activeGameTitle = document.getElementById('active-game-title');

// 1. Uruchamianie gry w trybie 'fullscreen' (bez menu) lub 'sidebar' (z menu)
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

// 2. Powrót do Huba
function closeGame() {
  gameIframe.src = 'about:blank';
  gameRunner.classList.add('hidden');
  dashboard.classList.remove('hidden');
  appLayout.classList.remove('fullscreen-mode');
}

// 3. Ręczne przełączenie pełnego ekranu w małych grach
function toggleFullscreenMode() {
  appLayout.classList.toggle('fullscreen-mode');
}

// 4. Filtrowanie kafelków Bento po kategoriach
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

// 5. Symulacja logowania (docelowo podepniemy tu Supabase Auth)
let isLoggedIn = false;
const btnAuth = document.getElementById('btn-auth');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const userAvatar = document.getElementById('user-avatar');
const lockIndicator = document.getElementById('lock-indicator');
const leclercContent = document.getElementById('leclerc-feed-content');

btnAuth.addEventListener('click', () => {
  isLoggedIn = !isLoggedIn;
  if (isLoggedIn) {
    userName.textContent = 'Andrzej';
    userRole.textContent = 'Administrator // Zespół IT';
    userAvatar.textContent = 'A';
    btnAuth.textContent = 'Wyloguj';
    lockIndicator.textContent = '🔓 Odblokowano';
    leclercContent.innerHTML = `
      <ul class="news-list">
        <li>
          <span class="source-badge sec">Wiadomości Handlowe</span>
          <a href="#" target="_blank">E.Leclerc rozwija systemy samoobsługowe i modernizuje infrastrukturę IT w sklepach</a>
          <time>Dzisiaj, 09:10</time>
        </li>
        <li>
          <span class="source-badge nieb">Portal Spożywczy</span>
          <a href="#" target="_blank">Nowe promocje i wyniki sieci E.Leclerc w Polsce – podsumowanie miesiąca</a>
          <time>Wczoraj</time>
        </li>
      </ul>
    `;
  } else {
    userName.textContent = 'Tryb Gościa';
    userRole.textContent = 'Tylko publiczne moduły';
    userAvatar.textContent = '?';
    btnAuth.textContent = 'Zaloguj się';
    lockIndicator.textContent = '🔒 Wymagane logowanie';
    leclercContent.innerHTML = `<p class="locked-placeholder">Zaloguj się na swoje konto, aby odblokować automatyczny raport wzmianek z polskich mediów oraz tablice wyników zespołu.</p>`;
  }
});

// 6. Zegar w pasku górnym
function updateClock() {
  const now = new Date();
  document.getElementById('clock-widget').textContent = now.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();