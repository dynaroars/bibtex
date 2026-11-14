import { parseBibTeX, groupByYear, groupByType, groupByDefault } from './parser.js';
import { renderPublications, updateStats, escapeHtml } from './renderer.js';

const DEFAULT_BIB_URL = new URL('./bib/roars.bib', window.location.href).href;
const GROUPERS = { default: groupByDefault, year: groupByYear, type: groupByType };

const $ = (id) => document.getElementById(id);
const sourceForm = $('sourceForm');
const urlInput = $('urlInput');
const fileInput = $('fileInput');
const searchInput = $('searchInput');
const groupSelect = $('groupSelect');
const excludePreprints = $('excludePreprints');
const statusEl = $('status');
const container = $('publications-container');
const bibtexModal = $('bibtexModal');
const bibtexContent = $('bibtexContent');
const copyBibtex = $('copyBibtex');

let publications = [];
let activeLoad;

function beginLoad() {
  activeLoad?.abort();
  activeLoad = new AbortController();
  return activeLoad.signal;
}

// The form controls are the source of truth; the URL query string mirrors them.
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  urlInput.value = params.get('bib') || DEFAULT_BIB_URL;
  searchInput.value = params.get('q') || '';
  if (Object.hasOwn(GROUPERS, params.get('group'))) groupSelect.value = params.get('group');
  if (params.has('exclude_preprints')) excludePreprints.checked = params.get('exclude_preprints') === 'true';
}

function writeUrlState() {
  const params = new URLSearchParams();
  const bibUrl = urlInput.value.trim();
  const query = searchInput.value.trim().toLowerCase();

  if (bibUrl && bibUrl !== DEFAULT_BIB_URL) params.set('bib', bibUrl);
  if (query) params.set('q', query);
  if (groupSelect.value !== 'default') params.set('group', groupSelect.value);
  if (!excludePreprints.checked) params.set('exclude_preprints', 'false');

  const search = params.size ? `?${params}` : '';
  window.history.replaceState({}, '', `${window.location.pathname}${search}${window.location.hash}`);
}

function refresh() {
  writeUrlState();
  display();
}

function display() {
  const query = searchInput.value.trim().toLowerCase();
  let filtered = publications;

  if (query) {
    filtered = filtered.filter(pub => [
      pub.title, pub.authors, pub.venue, pub.year, pub.type, ...pub.keywords.map(k => `#${k}`)
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }

  if (excludePreprints.checked) {
    filtered = filtered.filter(pub => pub.type !== 'preprint');
  }

  statusEl.textContent = '';
  renderPublications(GROUPERS[groupSelect.value](filtered), container);
  updateStats(filtered, publications);
}

function showError(title, message) {
  publications = [];
  statusEl.textContent = '';
  updateStats();
  $('section-nav').innerHTML = '';
  container.innerHTML = `
    <div role="alert">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function processContent(content, sourceName) {
  publications = parseBibTeX(content);
  if (publications.length === 0) {
    showError('No valid BibTeX found', `No publications could be parsed from "${sourceName}". Please ensure it contains BibTeX entries (@article, @inproceedings, etc.).`);
    return;
  }
  display();
}

async function readFile(file) {
  const signal = beginLoad();
  urlInput.value = '';
  writeUrlState();
  statusEl.textContent = `Reading ${file.name}...`;

  try {
    const content = await file.text();
    if (signal.aborted) return;
    if (!content.trim()) throw new Error('the file is empty');
    processContent(content, file.name);
  } catch (err) {
    if (signal.aborted) return;
    showError('Failed to read file', `Could not read "${file.name}": ${err.message}.`);
  }
}

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) throw new Error('Please enter a .bib URL.');
  if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Please use an HTTP or HTTPS URL.');
  // GitHub "blob" pages are HTML; the raw file lives on another host.
  if (parsed.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/blob\//.test(parsed.pathname)) {
    parsed.hostname = 'raw.githubusercontent.com';
    parsed.pathname = parsed.pathname.replace(/^(\/[^/]+\/[^/]+)\/blob\//, '$1/');
  }
  return parsed.href;
}

async function loadFromUrl(input) {
  const signal = beginLoad();
  let url;
  try {
    url = normalizeUrl(input);
  } catch (err) {
    showError('Invalid URL', err instanceof TypeError ? `"${input}" is not a valid web address.` : err.message);
    return;
  }

  urlInput.value = url;
  writeUrlState();
  statusEl.textContent = 'Loading publications...';

  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    if (signal.aborted) return;
    processContent(content, url);
  } catch (err) {
    if (signal.aborted) return;
    showError('Could not load URL', `Unable to load BibTeX from "${url}" (${err.message}). The server may be unreachable or may not allow cross-origin requests; try uploading the .bib file instead.`);
  }
}

sourceForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loadFromUrl(urlInput.value);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) readFile(fileInput.files[0]);
});

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && /\.(bib|bibtex|txt)$/i.test(file.name)) readFile(file);
});

searchInput.addEventListener('input', refresh);
groupSelect.addEventListener('change', refresh);
excludePreprints.addEventListener('change', refresh);

container.addEventListener('click', (e) => {
  const keyword = e.target.closest('[data-keyword]');
  if (keyword) {
    e.preventDefault();
    searchInput.value = `#${keyword.dataset.keyword}`;
    refresh();
    return;
  }

  const bibtex = e.target.closest('[data-bibtex]');
  if (bibtex) {
    e.preventDefault();
    const pub = publications.find(p => p.key === bibtex.dataset.bibtex);
    if (pub?.raw) {
      bibtexContent.textContent = pub.raw.trim();
      bibtexModal.showModal();
    }
  }
});

$('closeModal').addEventListener('click', () => bibtexModal.close());

copyBibtex.addEventListener('click', async () => {
  await navigator.clipboard.writeText(bibtexContent.textContent);
  copyBibtex.textContent = 'Copied!';
  setTimeout(() => { copyBibtex.textContent = 'Copy to Clipboard'; }, 1800);
});

readUrlState();
loadFromUrl(urlInput.value);
