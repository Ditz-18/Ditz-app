/* ============================================================
   DITZ APP — app.js
   ============================================================ */

/* ─── State ─── */
const state = {
  currentPage    : 'home',
  activeProject  : null,
  projects       : [],
  isOnline       : navigator.onLine,
  deferredInstall: null,   // holds BeforeInstallPromptEvent
};

/* ─── DOM References ─── */
const dom = {
  // Pages
  pages          : () => document.querySelectorAll('.page'),
  homePage       : () => document.getElementById('homePage'),
  settingsPage   : () => document.getElementById('settingsPage'),
  aboutPage      : () => document.getElementById('aboutPage'),

  // Nav items (sidebar + bottom)
  navItems       : () => document.querySelectorAll('.nav-item, .bottom-nav-item'),

  // Project grid
  projectGrid    : () => document.getElementById('projectGrid'),

  // Viewer
  viewer         : () => document.getElementById('viewer'),
  viewerFavicon  : () => document.querySelector('.viewer-favicon'),
  viewerName     : () => document.getElementById('viewerName'),
  viewerIframe   : () => document.getElementById('viewerIframe'),
  viewerLoader   : () => document.getElementById('viewerLoader'),
  viewerOffline  : () => document.getElementById('viewerOffline'),
  viewerExitBtn  : () => document.getElementById('viewerExitBtn'),

  // Modal
  modal          : () => document.getElementById('exitModal'),
  modalCancel    : () => document.getElementById('modalCancel'),
  modalConfirm   : () => document.getElementById('modalConfirm'),

  // Network
  offlineBanner  : () => document.getElementById('offlineBanner'),
  connDot        : () => document.getElementById('connDot'),
  connStatus     : () => document.getElementById('connStatus'),

  // Theme
  themeDark      : () => document.getElementById('themeDark'),
  themeLight     : () => document.getElementById('themeLight'),

  // Install PWA
  installPwaBtn  : () => document.getElementById('installPwaBtn'),
  installNotice  : () => document.getElementById('installNotice'),

  // Portfolio iframe
  portfolioIframe: () => document.getElementById('portfolioIframe'),
};

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await loadProjects();
  renderProjectGrid();
  bindNav();
  bindViewer();
  bindModal();
  bindNetwork();
  bindTheme();
  bindInstall();
  updateNetworkUI(navigator.onLine);
});

/* ================================================================
   THEME
   ================================================================ */
function loadTheme() {
  const saved = localStorage.getItem('ditz-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ditz-theme', theme);

  const dark  = dom.themeDark();
  const light = dom.themeLight();
  if (!dark || !light) return;

  if (theme === 'dark') {
    dark.classList.add('active');
    light.classList.remove('active');
  } else {
    light.classList.add('active');
    dark.classList.remove('active');
  }
}

function bindTheme() {
  dom.themeDark()?.addEventListener('click', () => applyTheme('dark'));
  dom.themeLight()?.addEventListener('click', () => applyTheme('light'));
}

/* ================================================================
   LOAD PROJECTS
   ================================================================ */
async function loadProjects() {
  try {
    const res = await fetch('projects.json');
    state.projects = await res.json();
  } catch (e) {
    console.warn('Gagal memuat projects.json', e);
    state.projects = [];
  }
}

/* ================================================================
   FAVICON HELPER
   ================================================================ */

/**
 * Returns favicon URL with multi-source fallback chain:
 * 1. gstatic faviconV2 (lebih reliable dari google s2)
 * 2. DuckDuckGo favicon service
 * 3. Fallback ke initials di HTML (via onerror)
 */
function getFaviconUrl(domain, size = 64) {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${size}`;
}

function getDDGFaviconUrl(domain) {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

/**
 * Pasang favicon ke <img> dengan fallback otomatis:
 * gstatic → DuckDuckGo → initials
 */
function setFaviconWithFallback(imgEl, domain, fallbackEl = null) {
  imgEl.src = getFaviconUrl(domain);

  imgEl.onerror = () => {
    // Coba DuckDuckGo dulu
    imgEl.onerror = () => {
      // Semua gagal — tampilkan initials
      imgEl.style.display = 'none';
      if (fallbackEl) fallbackEl.style.display = 'flex';
    };
    imgEl.src = getDDGFaviconUrl(domain);
  };
}

/* ================================================================
   RENDER PROJECT GRID
   ================================================================ */
function renderProjectGrid() {
  const grid = dom.projectGrid();
  if (!grid) return;

  grid.innerHTML = '';

  state.projects.forEach(project => {
    const initials = project.name.substring(0, 2).toUpperCase();

    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.setProperty('--card-color', project.color);
    card.dataset.projectId = project.id;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-favicon">
          <img alt="${project.name}" data-domain="${project.domain}" />
          <span class="card-favicon-fallback" style="display:none">${initials}</span>
        </div>
        <div class="card-arrow">
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
      <div class="card-name">${project.name}</div>
      <div class="card-desc">${project.description}</div>
      <div class="card-domain">${project.domain}</div>
    `;

    // Pasang favicon dengan fallback chain setelah card masuk DOM
    card.addEventListener('click', () => openProject(project));
    grid.appendChild(card);

    // Set favicon setelah element ada di DOM
    const imgEl      = card.querySelector('.card-favicon img');
    const fallbackEl = card.querySelector('.card-favicon-fallback');
    setFaviconWithFallback(imgEl, project.domain, fallbackEl);
  });
}

/* ================================================================
   NAVIGATION
   ================================================================ */
function bindNav() {
  dom.navItems().forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

function navigateTo(pageId) {
  if (state.currentPage === pageId) return;
  state.currentPage = pageId;

  // Switch active page
  dom.pages().forEach(p => p.classList.remove('active'));
  document.getElementById(pageId + 'Page')?.classList.add('active');

  // Update nav active state
  dom.navItems().forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });
}

/* ================================================================
   PROJECT VIEWER
   ================================================================ */
function openProject(project) {
  if (!state.isOnline) {
    showViewerOffline();
    showViewer(project);
    return;
  }

  state.activeProject = project;

  // Set viewer bar info
  const viewerImg = dom.viewerFavicon().querySelector('img');
  setFaviconWithFallback(viewerImg, project.domain);
  dom.viewerName().textContent = project.name;

  // Show loader, hide offline state
  dom.viewerLoader().classList.remove('hide');
  dom.viewerOffline().classList.remove('show');

  // Load iframe
  const iframe = dom.viewerIframe();
  iframe.src = '';

  setTimeout(() => {
    iframe.src = project.url;
  }, 80);

  showViewer(project);
}

function showViewer(project) {
  if (project && dom.viewerName()) {
    const viewerImg = dom.viewerFavicon().querySelector('img');
    setFaviconWithFallback(viewerImg, project.domain);
    dom.viewerName().textContent = project.name;
  }
  dom.viewer().classList.add('active');
  document.body.style.overflow = 'hidden';

  // Lock orientation to match current system lock state
  lockOrientationToSystem();
}

function hideViewer() {
  dom.viewer().classList.remove('active');
  document.body.style.overflow = '';

  // Release orientation lock when exiting viewer
  unlockOrientation();

  // Clear iframe after transition
  setTimeout(() => {
    dom.viewerIframe().src = '';
    state.activeProject = null;
  }, 300);
}

/**
 * Lock screen orientation to whatever the system/user currently has.
 * If the system is already locked (e.g. portrait-primary), we lock to
 * that same type so rotation is disabled inside the viewer.
 * If the system is NOT locked, we also leave it unlocked (natural).
 */
async function lockOrientationToSystem() {
  if (!screen.orientation || typeof screen.orientation.lock !== 'function') return;
  try {
    const currentType = screen.orientation.type; // e.g. "portrait-primary"
    await screen.orientation.lock(currentType);
  } catch (err) {
    // Browser may disallow locking (e.g. desktop) — silently ignore
  }
}

function unlockOrientation() {
  if (!screen.orientation || typeof screen.orientation.unlock !== 'function') return;
  try {
    screen.orientation.unlock();
  } catch (err) {
    // Silently ignore
  }
}

function showViewerOffline() {
  dom.viewerOffline().classList.add('show');
  dom.viewerLoader().classList.add('hide');
}

function bindViewer() {
  // Iframe loaded
  dom.viewerIframe()?.addEventListener('load', () => {
    dom.viewerLoader().classList.add('hide');
  });

  // Exit button
  dom.viewerExitBtn()?.addEventListener('click', () => {
    showExitModal();
  });

  // Retry button inside offline state
  document.getElementById('retryBtn')?.addEventListener('click', () => {
    if (state.isOnline && state.activeProject) {
      openProject(state.activeProject);
    }
  });
}

/* ================================================================
   EXIT CONFIRMATION MODAL
   ================================================================ */
function showExitModal() {
  const modal = dom.modal();
  const name  = state.activeProject?.name || 'project ini';

  document.getElementById('modalProjectName').textContent = name;
  modal.classList.add('active');
}

function hideExitModal() {
  dom.modal().classList.remove('active');
}

function bindModal() {
  dom.modalCancel()?.addEventListener('click', hideExitModal);
  dom.modalConfirm()?.addEventListener('click', () => {
    hideExitModal();
    hideViewer();
  });

  // Close on backdrop click
  dom.modal()?.addEventListener('click', (e) => {
    if (e.target === dom.modal()) hideExitModal();
  });
}

/* ================================================================
   NETWORK / OFFLINE DETECTION
   ================================================================ */
function bindNetwork() {
  window.addEventListener('online',  () => updateNetworkUI(true));
  window.addEventListener('offline', () => updateNetworkUI(false));
}

function updateNetworkUI(online) {
  state.isOnline = online;

  // Banner
  dom.offlineBanner()?.classList.toggle('show', !online);

  // Sidebar dot
  const dot = dom.connDot();
  if (dot) {
    dot.classList.toggle('offline', !online);
  }

  // Status text
  const status = dom.connStatus();
  if (status) status.textContent = online ? 'Online' : 'Offline';

  // If viewer is open and goes offline
  if (!online && dom.viewer()?.classList.contains('active')) {
    showViewerOffline();
  }

  // If back online and viewer is open with a project
  if (online && dom.viewer()?.classList.contains('active') && state.activeProject) {
    dom.viewerOffline().classList.remove('show');
    openProject(state.activeProject);
  }
}

/* ================================================================
   PWA INSTALL
   ================================================================ */
function bindInstall() {
  const btn    = dom.installPwaBtn();
  const notice = dom.installNotice();

  // Capture the install prompt before it fires
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstall = e;

    // Make sure button is enabled and ready
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-download"></i> Install';
    }
    if (notice) notice.style.display = 'none';
  });

  // Handle already-installed (app launched in standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstal';
    }
    if (notice) {
      notice.style.display  = 'flex';
      notice.className      = 'install-notice notice-ok';
      notice.innerHTML      = '<i class="fa-solid fa-circle-check"></i> Ditz App sudah terinstal di perangkat ini.';
    }
    return;
  }

  // Button click → trigger native install prompt
  btn?.addEventListener('click', async () => {
    if (!state.deferredInstall) {
      // Browser doesn't support install prompt (e.g. already installed or not eligible)
      if (notice) {
        notice.style.display  = 'flex';
        notice.className      = 'install-notice notice-info';
        notice.innerHTML      = '<i class="fa-solid fa-circle-info"></i> Install tidak tersedia. Gunakan menu browser (Add to Home Screen) untuk memasang aplikasi.';
      }
      return;
    }

    state.deferredInstall.prompt();
    const { outcome } = await state.deferredInstall.userChoice;
    state.deferredInstall = null;

    if (outcome === 'accepted') {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstal';
      }
      if (notice) {
        notice.style.display  = 'flex';
        notice.className      = 'install-notice notice-ok';
        notice.innerHTML      = '<i class="fa-solid fa-circle-check"></i> Ditz App berhasil diinstal!';
      }
    } else {
      if (notice) {
        notice.style.display  = 'flex';
        notice.className      = 'install-notice notice-info';
        notice.innerHTML      = '<i class="fa-solid fa-circle-info"></i> Instalasi dibatalkan.';
        setTimeout(() => { notice.style.display = 'none'; }, 3000);
      }
    }
  });

  // Listen for successful app install from outside (e.g. browser UI)
  window.addEventListener('appinstalled', () => {
    state.deferredInstall = null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstal';
    }
    if (notice) {
      notice.style.display  = 'flex';
      notice.className      = 'install-notice notice-ok';
      notice.innerHTML      = '<i class="fa-solid fa-circle-check"></i> Ditz App berhasil diinstal!';
    }
  });
}