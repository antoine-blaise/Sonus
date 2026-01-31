const DOM = {
  form: document.getElementById('searchForm'),
  q: document.getElementById('q'),
  results: document.getElementById('results'),
  audio: document.getElementById('audio'),
  playerCover: document.getElementById('player-cover'),
  playerTitle: document.getElementById('player-title'),
  playerArtist: document.getElementById('player-artist'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  progress: document.getElementById('progress'),
  currentTime: document.getElementById('currentTime'),
  duration: document.getElementById('duration'),
  queueList: document.getElementById('queueList'),
  themeToggle: document.getElementById('themeToggle')
};

// State
let queue = JSON.parse(localStorage.getItem('mz:queue') || '[]');
let currentIndex = parseInt(localStorage.getItem('mz:currentIndex') || '-1', 10);
let isPlaying = false;

// Persist helpers
function persistState(){
  localStorage.setItem('mz:queue', JSON.stringify(queue));
  localStorage.setItem('mz:currentIndex', String(currentIndex));
}

// Them toggling
const THEME_KEY = 'mz:theme';
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
  DOM.themeToggle.textContent = saved === 'dark' ? '🌗' : '🌞';
})();
DOM.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  DOM.themeToggle.textContent = next === 'dark' ? '🌗' : '🌞';
});

// JSONP helper for Deezer (public search)
function jsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const cb = callbackName || ('cb_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    window[cb] = function (data) {
      resolve(data);
      delete window[cb];
      script.remove();
    };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
    script.onerror = () => {
      reject(new Error('Network / JSONP error'));
      delete window[cb];
      script.remove();
    };
    document.body.appendChild(script);
  });
}

// Render search results
function renderResults(data){
  DOM.results.innerHTML = '';
  if (!data || !data.data || data.data.length === 0){
    DOM.results.innerHTML = '<p class="muted">No results</p>';
    return;
  }
  data.data.forEach(track => {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;

    const img = document.createElement('img');
    img.src = (track.album && track.album.cover_medium) || '';
    img.alt = `${track.title} cover`;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = track.title;

    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `${track.artist.name} — ${track.album.title}`;

    meta.appendChild(name);
    meta.appendChild(sub);
    card.appendChild(img);
    card.appendChild(meta);

    // add to queue on click
    card.addEventListener('click', () => addToQueue(track));
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter') addToQueue(track); });

    DOM.results.appendChild(card);
  });
}

// Queue logic
function addToQueue(track){
  queue.push(track);
  if (currentIndex === -1){
    currentIndex = 0;
    loadTrack(queue[currentIndex]);
  }
  renderQueue();
  persistState();
}

function renderQueue(){
  DOM.queueList.innerHTML = '';
  if (queue.length === 0){
    DOM.queueList.innerHTML = '<li class="muted">Queue is empty</li>';
    return;
  }
  queue.forEach((track, index) => {
    const li = document.createElement('li');
    li.textContent = track.title + ' — ' + track.artist.name;
    if (index === currentIndex) li.classList.add('active');
    li.addEventListener('click', () => {
      currentIndex = index;
      loadTrack(track);
      renderQueue();
      persistState();
    });
    DOM.queueList.appendChild(li);
  });
}

function loadTrack(track){
  if (!track || !track.preview) {
    alert('No preview available for this track.');
    return;
  }
  DOM.audio.src = track.preview;
  DOM.playerCover.src = track.album.cover_big || track.album.cover_medium || '';
  DOM.playerTitle.textContent = track.title;
  DOM.playerArtist.textContent = track.artist.name;

  DOM.audio.play().catch(() => {
    console.warn('Autoplay prevented — awaiting user gesture.');
  });
  isPlaying = true;
  DOM.playPauseBtn.textContent = '⏸';
}

// Controls
DOM.playPauseBtn.addEventListener('click', () => {
  if (!DOM.audio.src) return;
  if (isPlaying){
    DOM.audio.pause();
    DOM.playPauseBtn.textContent = '▶';
  } else {
    DOM.audio.play();
    DOM.playPauseBtn.textContent = '⏸';
  }
  isPlaying = !isPlaying;
});

DOM.prevBtn.addEventListener('click', () => {
  if (currentIndex > 0){
    currentIndex--;
    loadTrack(queue[currentIndex]);
    renderQueue();
    persistState();
  }
});
DOM.nextBtn.addEventListener('click', () => {
  if (currentIndex < queue.length - 1){
    currentIndex++;
    loadTrack(queue[currentIndex]);
    renderQueue();
    persistState();
  }
});

// Progress and time updates
DOM.audio.addEventListener('timeupdate', () => {
  const dur = DOM.audio.duration || 30; // fallback
  const percent = (DOM.audio.currentTime / dur) * 100;
  DOM.progress.value = percent || 0;
  DOM.currentTime.textContent = formatTime(DOM.audio.currentTime || 0);
});

DOM.audio.addEventListener('loadedmetadata', () => {
  const dur = DOM.audio.duration || 30;
  DOM.duration.textContent = formatTime(dur);
});

DOM.progress.addEventListener('input', () => {
  const dur = DOM.audio.duration || 30;
  DOM.audio.currentTime = (DOM.progress.value / 100) * dur;
});

DOM.audio.addEventListener('ended', () => {
  // auto advance
  if (currentIndex < queue.length - 1){
    currentIndex++;
    loadTrack(queue[currentIndex]);
    renderQueue();
    persistState();
  } else {
    isPlaying = false;
    DOM.playPauseBtn.textContent = '▶';
  }
});

function formatTime(sec){
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Keyboard shortcuts: Space play/pause; Shift+ArrowRight next; Shift+ArrowLeft prev
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT'){
    e.preventDefault();
    DOM.playPauseBtn.click();
  }
  if (e.shiftKey && e.code === 'ArrowRight') DOM.nextBtn.click();
  if (e.shiftKey && e.code === 'ArrowLeft') DOM.prevBtn.click();
});

// Search handler
DOM.form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = DOM.q.value.trim();
  if (!q) return;
  DOM.results.innerHTML = '<p class="muted">Searching…</p>';
  const base = 'https://api.deezer.com/search';
  const url = base + '?q=' + encodeURIComponent(q);
  try {
    const data = await jsonp(url);
    renderResults(data);
  } catch (err) {
    console.error(err);
    DOM.results.innerHTML = '<p class="muted">Error fetching results. Possible CORS or network block.</p>';
  }
});

// Initialize UI from persisted state
(function init(){
  renderQueue();
  if (queue.length > 0 && currentIndex >= 0 && queue[currentIndex]){
    // Load but do not auto play; user gesture is required by some browsers
    loadTrack(queue[currentIndex]);
  }
})();