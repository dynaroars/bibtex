// Renderer for BibTeX publications and summary stats

export function renderPublications(groups, container) {
  container.innerHTML = '';

  if (!groups || groups.length === 0 || groups.every(g => !g.publications || g.publications.length === 0)) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-text">No publications found matching your search or filters.</p>
      </div>
    `;
    return;
  }

  groups.forEach((group) => {
    if (!group.publications || group.publications.length === 0) return;

    const groupEl = document.createElement('section');
    groupEl.className = 'year-group';

    const count = group.publications.length;
    const isSingleGroup = group.year === 'All Publications';

    groupEl.innerHTML = `
      <div class="year-header">
        <h2 class="year-title">${escapeHtml(group.year)}</h2>
        <span class="year-count">${count} ${count === 1 ? 'publication' : 'publications'}</span>
      </div>
      <div class="year-publications">
        ${group.publications.map((pub, index) => renderPublicationCard(pub, index, isSingleGroup || isNaN(Number(group.year)))).join('')}
      </div>
    `;

    container.appendChild(groupEl);
  });
}

function renderPublicationCard(pub, index, showYear = false) {
  const links = generateLinks(pub);
  const primaryUrl = pub.pdfUrl || pub.url || (pub.doi ? `https://doi.org/${pub.doi}` : null);
  const titleHtml = primaryUrl
    ? `<a href="${escapeHtml(primaryUrl)}" class="pub-title-link" target="_blank" rel="noopener noreferrer">${sanitizeLatexHtml(pub.title)}</a>`
    : sanitizeLatexHtml(pub.title);

  return `
    <article class="pub-card" data-key="${escapeHtml(pub.key)}">
      <div class="pub-header">
        <h3 class="pub-title">
          ${titleHtml}
          <span class="pub-type-badge type-${pub.type}">${getTypeName(pub.type)}</span>
        </h3>
      </div>
      <p class="pub-authors">${sanitizeLatexHtml(pub.authors)}</p>
      <div class="pub-venue">
        ${pub.venue ? `<span class="venue-name"><em>${sanitizeLatexHtml(pub.venue)}</em></span>` : ''}
        ${(pub.volume || pub.number) ? `<span class="venue-vol">${escapeHtml(pub.volume || '')}${pub.volume && pub.number ? '.' : ''}${escapeHtml(pub.number || '')}</span>` : ''}
        ${showYear && pub.year ? `<span class="venue-year">(${pub.year})</span>` : ''}
        ${pub.publisher ? `<span class="venue-publisher">${sanitizeLatexHtml(pub.publisher)}</span>` : ''}
        ${pub.pages ? `<span class="venue-pages">pp. ${escapeHtml(pub.pages)}</span>` : (pub.year && pub.year >= new Date().getFullYear() ? '<span class="venue-pages to-appear">to appear</span>' : '')}
      </div>
      ${pub.awards && pub.awards.length > 0 ? `
        <div class="pub-awards">
          ${pub.awards.map(award => `<span class="pub-award">🏆 ${sanitizeLatexHtml(award)}</span>`).join('')}
        </div>
      ` : ''}
      ${pub.keywords && pub.keywords.length > 0 ? `
        <div class="pub-keywords">
          ${pub.keywords.map(kw => `<button type="button" class="pub-keyword-btn" data-keyword="${escapeHtml(kw)}">#${sanitizeLatexHtml(kw)}</button>`).join('')}
        </div>
      ` : ''}
      ${links.length > 0 ? `
        <div class="pub-links">
          ${links.join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function generateLinks(pub) {
  const links = [];

  if (pub.raw) {
    links.push(`<button type="button" class="pub-link-btn bibtex-link" data-key="${escapeHtml(pub.key)}">BibTeX</button>`);
  }

  const pdfLink = pub.pdfUrl || (pub.url && pub.url.toLowerCase().endsWith('.pdf') ? pub.url : null);
  if (pdfLink) {
    links.push(`<a href="${escapeHtml(pdfLink)}" class="pub-link-btn" target="_blank" rel="noopener noreferrer">PDF</a>`);
  }

  if (pub.doi) {
    links.push(`<a href="https://doi.org/${escapeHtml(pub.doi)}" class="pub-link-btn" target="_blank" rel="noopener noreferrer">DOI</a>`);
  }

  if (pub.eprint) {
    links.push(`<a href="https://arxiv.org/abs/${escapeHtml(pub.eprint)}" class="pub-link-btn" target="_blank" rel="noopener noreferrer">arXiv</a>`);
  }

  if (pub.url && pub.url !== pdfLink && !pub.url.includes('doi.org') && !pub.url.includes('arxiv.org')) {
    links.push(`<a href="${escapeHtml(pub.url)}" class="pub-link-btn" target="_blank" rel="noopener noreferrer">URL</a>`);
  }

  return links;
}

function getTypeName(type) {
  const names = {
    conference: 'Conference',
    journal: 'Journal',
    book: 'Book',
    techreport: 'Tech Report',
    thesis: 'Thesis',
    preprint: 'Preprint',
    misc: 'Other'
  };
  return names[type] || 'Other';
}

export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeLatexHtml(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped
    .replace(/&lt;sup&gt;/g, '<sup>')
    .replace(/&lt;\/sup&gt;/g, '</sup>')
    .replace(/&lt;sub&gt;/g, '<sub>')
    .replace(/&lt;\/sub&gt;/g, '</sub>')
    .replace(/&lt;em&gt;/g, '<em>')
    .replace(/&lt;\/em&gt;/g, '</em>')
    .replace(/&lt;strong&gt;/g, '<strong>')
    .replace(/&lt;\/strong&gt;/g, '</strong>');
}

export function updateStats(filteredCount, totalCount, publications = []) {
  const countEl = document.getElementById('result-count');
  if (!countEl) return;

  if (totalCount === 0) {
    countEl.textContent = '';
    return;
  }

  const years = new Set(publications.map(p => p.year).filter(y => y > 0));
  const venues = new Set(publications.map(p => p.venue).filter(Boolean));

  let text = '';
  if (filteredCount === totalCount) {
    text = `${totalCount} ${totalCount === 1 ? 'publication' : 'publications'}`;
    if (years.size > 0) text += ` · ${years.size} ${years.size === 1 ? 'year' : 'years'}`;
    if (venues.size > 0) text += ` · ${venues.size} ${venues.size === 1 ? 'venue' : 'venues'}`;
  } else {
    text = `Showing ${filteredCount} of ${totalCount} publications`;
    if (years.size > 0) text += ` across ${years.size} ${years.size === 1 ? 'year' : 'years'}`;
    if (venues.size > 0) text += ` and ${venues.size} ${venues.size === 1 ? 'venue' : 'venues'}`;
  }

  countEl.textContent = text;
}
