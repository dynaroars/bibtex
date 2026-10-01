// Renderer for BibTeX publications and summary stats
import { TYPES } from './parser.js';

// For these the title already links to the entry's URL.
const TITLE_LINK_ONLY = new Set(['tool', 'benchmark', 'news']);

const AUTHOR_LEVELS = { 1: 'Undergraduate student', 2: "Master's student", 3: 'PhD student' };

export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escapes text but keeps the few inline tags cleanLatex can produce.
export function sanitizeLatexHtml(text) {
  return escapeHtml(text).replace(/&lt;(\/?)(sup|sub|em|strong)&gt;/g, '<$1$2>');
}

const link = (href, text) => `<a href="${escapeHtml(href)}">${text}</a>`;

export function renderPublications(groups, container) {
  const nonEmpty = (groups || []).filter(g => g.publications?.length > 0);

  if (nonEmpty.length === 0) {
    container.innerHTML = '<p>No publications found matching your search or filters.</p>';
    return;
  }

  container.innerHTML = nonEmpty.map(group => {
    const showYear = isNaN(Number(group.label));
    return `
      <section>
        <h2>${escapeHtml(group.label)} (${group.publications.length})</h2>
        <ol reversed>
          ${group.publications.map(pub => renderPublication(pub, showYear)).join('')}
        </ol>
      </section>
    `;
  }).join('');
}

export function renderPublication(pub, showYear = false) {
  const title = sanitizeLatexHtml(pub.title);
  const titleUrl = pub.url || (pub.doi && `https://doi.org/${pub.doi}`);
  const typeLabel = TYPES.find(t => t.id === pub.type)?.label;

  const venue = [];
  if (pub.venue) venue.push(`<em>${sanitizeLatexHtml(pub.venue)}</em>`);
  if (pub.volume || pub.number) venue.push([pub.volume, pub.number].filter(Boolean).map(escapeHtml).join('.'));
  if (showYear && pub.year) venue.push(`(${pub.year})`);
  if (pub.publisher) venue.push(sanitizeLatexHtml(pub.publisher));
  if (pub.pages) venue.push(`pp. ${escapeHtml(pub.pages)}`);
  else if (pub.year >= new Date().getFullYear()) venue.push('to appear');

  const links = [
    pub.raw && `<a href="#" data-bibtex="${escapeHtml(pub.key)}">BibTeX</a>`,
    pub.url && !TITLE_LINK_ONLY.has(pub.type) && link(pub.url, /\.pdf($|[?#])/i.test(pub.url) ? 'PDF' : 'Link'),
    pub.doi && link(`https://doi.org/${pub.doi}`, 'DOI'),
    pub.eprint && link(`https://arxiv.org/abs/${pub.eprint}`, 'arXiv')
  ].filter(Boolean);

  const lines = [
    labelAuthorLevels(sanitizeLatexHtml(pub.authors)),
    venue.join(' '),
    pub.awards.map(award => `🏆 ${sanitizeLatexHtml(award)}`).join(' '),
    pub.keywords.map(kw => `<a href="#" data-keyword="${escapeHtml(kw)}">#${sanitizeLatexHtml(kw)}</a>`).join(' '),
    links.join(' | ')
  ].filter(Boolean);

  return `
    <li data-key="${escapeHtml(pub.key)}">
      <strong>${titleUrl ? link(titleUrl, title) : title}</strong> [${typeLabel}]<br>
      ${lines.join('<br>')}
    </li>
  `;
}

function labelAuthorLevels(html) {
  return html.replace(/<sup>([123])<\/sup>/g, (_, n) => `<sup title="${AUTHOR_LEVELS[n]}">${n}</sup>`);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function updateStats(filteredCount, totalCount, publications = []) {
  const countEl = document.getElementById('result-count');
  if (!countEl) return;

  if (totalCount === 0) {
    countEl.textContent = '';
    return;
  }

  const years = new Set(publications.map(p => p.year).filter(y => y > 0)).size;
  const venues = new Set(publications.map(p => p.venue).filter(Boolean)).size;
  const extras = [years && plural(years, 'year'), venues && plural(venues, 'venue')].filter(Boolean);

  countEl.textContent = filteredCount === totalCount
    ? [plural(totalCount, 'publication'), ...extras].join(' · ')
    : `Showing ${filteredCount} of ${plural(totalCount, 'publication')}` +
      (extras.length ? ` across ${extras.join(' and ')}` : '');
}
