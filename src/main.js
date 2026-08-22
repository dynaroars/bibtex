import { parseBibTeX, groupByYear, groupByType, groupByOriginal } from './parser.js';
import { renderPublications, updateStats, escapeHtml } from './renderer.js';

// Application State
let currentPublications = [];
let currentGrouping = 'default';
let searchQuery = '';

// DOM Elements
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const excludePreprints = document.getElementById('excludePreprints');
const groupButtons = document.querySelectorAll('.group-btn');
const publicationsContainer = document.getElementById('publications-container');
const backToTopBtn = document.getElementById('back-to-top');

const bibtexModal = document.getElementById('bibtexModal');
const bibtexContent = document.getElementById('bibtexContent');
const closeModal = document.getElementById('closeModal');
const copyBibtex = document.getElementById('copyBibtex');

const DEFAULT_BIB_URL = 'https://tvn.roars.dev/cv/cv.bib';

function init() {
  setupEventListeners();

  const params = new URLSearchParams(window.location.search);
  const customBibUrl = params.get('bib');
  const bibUrl = customBibUrl || DEFAULT_BIB_URL;

  const initialSearch = params.get('q');
  if (initialSearch) {
    searchQuery = initialSearch.toLowerCase().trim();
    searchInput.value = initialSearch;
  }

  const initialGroup = params.get('group');
  if (initialGroup && ['default', 'original', 'year', 'type'].includes(initialGroup)) {
    currentGrouping = initialGroup === 'original' ? 'default' : initialGroup;
    groupButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.group === currentGrouping);
    });
  }

  const initialExclude = params.get('exclude_preprints');
  if (initialExclude !== null) {
    excludePreprints.checked = initialExclude === 'true';
  }

  urlInput.value = bibUrl;
  loadFromUrl(bibUrl);
}

function updateUrl() {
  const params = new URLSearchParams();
  const bibUrl = urlInput.value.trim();

  if (bibUrl && bibUrl !== DEFAULT_BIB_URL) {
    params.set('bib', bibUrl);
  }
  if (searchQuery) {
    params.set('q', searchQuery);
  }
  if (currentGrouping && currentGrouping !== 'default' && currentGrouping !== 'original') {
    params.set('group', currentGrouping);
  }
  if (!excludePreprints.checked) {
    params.set('exclude_preprints', 'false');
  }

  const newSearch = params.toString() ? `?${params.toString()}` : '';
  const newUrl = `${window.location.pathname}${newSearch}`;
  window.history.replaceState({}, '', newUrl);
}

function setupEventListeners() {
  // URL and file loading
  loadUrlBtn.addEventListener('click', () => loadFromUrl(urlInput.value));
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadFromUrl(urlInput.value);
  });

  fileInput.addEventListener('change', handleFileSelect);

  // Drag & drop on window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.bib') || file.name.endsWith('.bibtex') || file.name.endsWith('.txt'))) {
      readFile(file);
    }
  });

  // Search and filters
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    updateUrl();
    displayPublications();
  });

  excludePreprints.addEventListener('change', () => {
    updateUrl();
    displayPublications();
  });

  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGrouping = btn.dataset.group || 'default';
      updateUrl();
      displayPublications();
    });
  });

  // Delegated clicks inside publications container
  publicationsContainer.addEventListener('click', (e) => {
    const keywordBtn = e.target.closest('.pub-keyword-btn');
    if (keywordBtn) {
      const keyword = keywordBtn.dataset.keyword;
      searchInput.value = `#${keyword}`;
      searchQuery = `#${keyword}`.toLowerCase().trim();
      updateUrl();
      displayPublications();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const bibtexBtn = e.target.closest('.bibtex-link');
    if (bibtexBtn) {
      const key = bibtexBtn.dataset.key;
      const pub = currentPublications.find(p => p.key === key);
      if (pub && pub.raw) {
        showBibtexModal(pub.raw);
      }
    }
  });

  // Back to Top Button
  window.addEventListener(
    'scroll',
    () => {
      if (backToTopBtn) {
        backToTopBtn.hidden = window.scrollY <= 300;
      }
    },
    { passive: true }
  );

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Modal actions
  closeModal.addEventListener('click', hideBibtexModal);
  window.addEventListener('click', (e) => {
    if (e.target === bibtexModal) hideBibtexModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !bibtexModal.classList.contains('hidden')) {
      hideBibtexModal();
    }
  });

  copyBibtex.addEventListener('click', () => {
    navigator.clipboard.writeText(bibtexContent.textContent || '').then(() => {
      const orig = copyBibtex.textContent;
      copyBibtex.textContent = 'Copied!';
      setTimeout(() => {
        copyBibtex.textContent = orig;
      }, 1800);
    });
  });
}

function showBibtexModal(rawBibtex) {
  bibtexContent.textContent = rawBibtex.trim();
  bibtexModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideBibtexModal() {
  bibtexModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (file) readFile(file);
}

function readFile(file) {
  urlInput.value = '';
  updateUrl();
  showToast(`Reading ${file.name}...`);

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result;
    if (typeof content !== 'string' || !content.trim()) {
      showErrorState('Empty or invalid file', `The file "${file.name}" is empty or could not be read.`);
      return;
    }
    processContent(content, file.name);
  };
  reader.onerror = () => {
    showErrorState('Failed to read file', `Could not read "${file.name}". Please check file permissions and try again.`);
  };
  reader.readAsText(file);
}

async function fetchWithTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out');
    }
    throw err;
  }
}

async function loadFromUrl(url) {
  let targetUrl = (url || '').trim();
  if (!targetUrl) {
    showErrorState('Invalid URL', 'Please enter a valid .bib URL to load publications.');
    return;
  }

  if (!targetUrl.match(/^https?:\/\//i)) {
    targetUrl = `https://${targetUrl}`;
    urlInput.value = targetUrl;
  }

  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      throw new Error('Invalid domain name');
    }
  } catch {
    showErrorState('Invalid URL', `"${targetUrl}" is not a valid web address. Please check the URL and try again.`);
    return;
  }

  // Rewrite github blob url to raw
  if (targetUrl.includes('github.com') && targetUrl.includes('/blob/')) {
    targetUrl = targetUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    urlInput.value = targetUrl;
  }

  updateUrl();
  showToast('Loading publications...');

  try {
    let content = null;

    // Step 1: Direct fetch with short 3s timeout
    try {
      const response = await fetchWithTimeout(targetUrl, 3000);
      if (response.ok) {
        content = await response.text();
      } else if (response.status === 404 || response.status === 410) {
        throw new Error('File not found (HTTP 404)');
      } else if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (directErr) {
      if (directErr.message.includes('404') || directErr.message.includes('400')) {
        throw directErr;
      }
      content = null;
    }

    // Step 2: Fallback via single fast CORS proxy only if direct was blocked
    if (content === null) {
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const response = await fetchWithTimeout(proxyUrl, 3000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content = await response.text();
      } catch {
        content = null;
      }
    }

    if (content === null) {
      throw new Error('Unable to retrieve file from URL');
    }

    processContent(content, targetUrl);
  } catch (err) {
    showErrorState(
      'Invalid or inaccessible URL',
      `Unable to load BibTeX from "${targetUrl}" (${err.message}). Please verify the URL or upload a local .bib file.`
    );
  }
}

function processContent(content, sourceName = '') {
  try {
    currentPublications = parseBibTeX(content);

    if (!currentPublications || currentPublications.length === 0) {
      showErrorState(
        'No valid BibTeX found',
        sourceName
          ? `No publications could be parsed from "${sourceName}". Please ensure the file contains valid BibTeX entries (@article, @inproceedings, etc.).`
          : 'No valid BibTeX entries found. Please ensure the file or URL contains standard BibTeX publications.'
      );
      return;
    }

    displayPublications();
  } catch (err) {
    showErrorState('BibTeX Parsing Error', `Failed to parse BibTeX data: ${err.message}`);
    console.error('Parse error:', err);
  }
}

function showErrorState(title, message) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  currentPublications = [];
  updateStats(0, 0, []);
  publicationsContainer.innerHTML = `
    <div class="empty-state error-state" role="alert">
      <h3 class="empty-title">${escapeHtml(title)}</h3>
      <p class="empty-text">${escapeHtml(message)}</p>
    </div>
  `;
}

function displayPublications() {
  let filtered = currentPublications;

  if (searchQuery) {
    filtered = filtered.filter(pub => {
      const searchFields = [
        pub.title,
        pub.authors,
        pub.venue,
        pub.year ? String(pub.year) : '',
        pub.type,
        ...(pub.keywords ? pub.keywords.map(k => `#${k}`) : [])
      ].filter(Boolean).join(' ').toLowerCase();

      return searchFields.includes(searchQuery);
    });
  }

  if (excludePreprints.checked) {
    filtered = filtered.filter(pub => pub.type !== 'preprint');
  }

  let groups;
  if (currentGrouping === 'year') {
    groups = groupByYear(filtered);
  } else if (currentGrouping === 'type') {
    groups = groupByType(filtered);
  } else {
    groups = groupByOriginal(filtered);
  }

  renderPublications(groups, publicationsContainer);
  updateStats(filtered.length, currentPublications.length, filtered);
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
