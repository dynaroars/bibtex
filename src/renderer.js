export function renderPublications(groups, container) {
  container.innerHTML = '';

  if (!groups || groups.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📖</span>
                <p>No publications found</p>
            </div>
        `;
    return;
  }

  groups.forEach((group, groupIndex) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'year-group';
    groupEl.style.animationDelay = `${groupIndex * 0.1}s`;

    groupEl.innerHTML = `
            <div class="year-header">
                <span class="year-badge">${group.year}</span>
                <span class="year-count">${group.publications.length} publication${group.publications.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="year-publications">
                ${group.publications.map((pub, pubIndex) => renderPublicationCard(pub, pubIndex, group.year === 'All Publications' || isNaN(group.year))).join('')}
            </div>
        `;

    container.appendChild(groupEl);
  });
}



function renderPublicationCard(pub, index, showYear = false) {
  const links = generateLinks(pub);
  const titleHtml = pub.pdfUrl || pub.url || pub.doi
    ? `<a href="${pub.pdfUrl || pub.url || `https://doi.org/${pub.doi}`}" target="_blank" rel="noopener">${sanitizeLatexHtml(pub.title)}</a>`
    : sanitizeLatexHtml(pub.title);

  return `
        <article class="pub-card" style="animation-delay: ${index * 0.05}s">
            <div class="pub-content">
                <h3 class="pub-title">${titleHtml}<span class="pub-type-badge ${pub.type}">${getTypeName(pub.type)}</span></h3>
                <p class="pub-authors">${sanitizeLatexHtml(pub.authors)}</p>
                <div class="pub-venue">
                    ${pub.venue ? `<span><em>${sanitizeLatexHtml(pub.venue)}</em></span>` : ''}
                    ${(pub.volume || pub.number) ? `<span>${pub.volume || ''}${pub.volume && pub.number ? '.' : ''}${pub.number || ''}</span>` : ''}
                    ${showYear && pub.year ? `<span>(${pub.year})</span>` : ''}
                    ${pub.publisher ? `<span>${sanitizeLatexHtml(pub.publisher)}</span>` : ''}
                    ${pub.pages ? `<span>pages ${pub.pages}</span>` : (pub.year >= new Date().getFullYear() ? '<span>to appear</span>' : '')}
                </div>
                ${pub.awards && pub.awards.length > 0 ? `
                    <div class="pub-awards">
                        ${pub.awards.map(award => `<span class="pub-award">🏆 ${sanitizeLatexHtml(award)}</span>`).join('')}
                    </div>
                ` : ''}
                ${links.length > 0 ? `
                    <div class="pub-links">
                        ${links.join('')}
                    </div>
                ` : ''}
            </div>
        </article>
    `;
}

function generateLinks(pub) {
  const links = [];

  // BibTeX link
  if (pub.raw) {
    links.push(`<a href="#" class="pub-link bibtex-link" data-key="${pub.key}" onclick="return false;">BibTeX</a>`);
  }

  // PDF link
  const pdfLink = pub.pdfUrl || pub.url;
  if (pdfLink) {
    links.push(`<a href="${pdfLink}" class="pub-link" target="_blank" rel="noopener">PDF</a>`);
  }

  if (pub.doi) {
    links.push(`<a href="https://doi.org/${pub.doi}" class="pub-link" target="_blank" rel="noopener">DOI</a>`);
  }

  if (pub.eprint) {
    links.push(`<a href="https://arxiv.org/abs/${pub.eprint}" class="pub-link" target="_blank" rel="noopener">arXiv</a>`);
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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeLatexHtml(text) {
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

export function updateStats(publications) {
  const totalPubs = publications.length;
  const years = new Set(publications.map(p => p.year).filter(y => y > 0));
  const venues = new Set(publications.map(p => p.venue).filter(v => v));

  document.getElementById('totalPubs').textContent = totalPubs;
  document.getElementById('totalYears').textContent = years.size;
  document.getElementById('totalVenues').textContent = venues.size;
  document.getElementById('stats-section').style.display = 'block';
}
