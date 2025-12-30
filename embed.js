/**
 * BibTeX Embed Widget
 * Usage: <script src="https://roars.dev/bibtex/embed.js?bib=URL_TO_BIB_FILE"></script>
 */
(function () {
    'use strict';

    // Get script parameters
    const currentScript = document.currentScript;
    const scriptSrc = currentScript ? currentScript.src : '';
    const params = new URLSearchParams(scriptSrc.split('?')[1] || '');
    let bibUrl = params.get('bib') || '';

    if (!bibUrl) {
        console.error('[BibTeX Embed] No bib URL provided. Usage: embed.js?bib=URL');
        return;
    }

    // Convert GitHub blob URL to raw
    if (bibUrl.includes('github.com') && bibUrl.includes('/blob/')) {
        bibUrl = bibUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    // Create container
    const container = document.createElement('div');
    container.className = 'bibtex-embed';
    container.innerHTML = '<div class="bibtex-loading">Loading publications...</div>';
    currentScript.parentNode.insertBefore(container, currentScript);

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .bibtex-embed {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
        }
        .bibtex-embed * { box-sizing: border-box; }
        .bibtex-loading {
            padding: 1rem;
            color: #666;
            font-style: italic;
        }
        .bibtex-error {
            padding: 1rem;
            color: #c00;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
        }
        .bibtex-group {
            margin-bottom: 1.5rem;
        }
        .bibtex-group-title {
            font-size: 1.1em;
            font-weight: 600;
            color: #111;
            border-bottom: 2px solid #333;
            padding-bottom: 0.25rem;
            margin-bottom: 0.75rem;
        }
        .bibtex-pub {
            padding: 0.75rem 0;
            border-bottom: 1px solid #eee;
        }
        .bibtex-pub:last-child { border-bottom: none; }
        .bibtex-title {
            font-weight: 500;
            color: #000;
            margin-bottom: 0.25rem;
        }
        .bibtex-title a {
            color: inherit;
            text-decoration: none;
        }
        .bibtex-title a:hover { text-decoration: underline; }
        .bibtex-authors {
            color: #555;
            font-size: 0.9em;
        }
        .bibtex-venue {
            color: #666;
            font-size: 0.85em;
            font-style: italic;
        }
        .bibtex-links {
            margin-top: 0.25rem;
        }
        .bibtex-links a {
            display: inline-block;
            font-size: 0.8em;
            color: #0066cc;
            margin-right: 0.75rem;
            text-decoration: none;
        }
        .bibtex-links a:hover { text-decoration: underline; }
        .bibtex-badge {
            display: inline-block;
            font-size: 0.7em;
            padding: 0.15em 0.4em;
            border-radius: 3px;
            background: #f0f0f0;
            color: #666;
            margin-left: 0.5rem;
            text-transform: uppercase;
            font-weight: 500;
        }
        .bibtex-footer {
            margin-top: 1rem;
            padding-top: 0.5rem;
            border-top: 1px solid #ddd;
            font-size: 0.75em;
            color: #999;
        }
        .bibtex-footer a { color: #666; }
        .bibtex-search {
            margin-bottom: 1rem;
        }
        .bibtex-search input {
            width: 100%;
            padding: 0.5rem 0.75rem;
            font-size: 0.9em;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
        }
        .bibtex-search input:focus {
            outline: none;
            border-color: #666;
        }
        .bibtex-search-count {
            font-size: 0.8em;
            color: #888;
            margin-top: 0.25rem;
        }
        .bibtex-awards {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin-top: 0.25rem;
        }
        .bibtex-award {
            display: inline-block;
            font-size: 0.75em;
            color: #856404;
            background: #fff3cd;
            padding: 0.1em 0.4em;
            border-radius: 3px;
            font-weight: 500;
        }
        .bibtex-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        }
        .bibtex-modal-content {
            background: #fff;
            padding: 1.5rem;
            border-radius: 12px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            position: relative;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .bibtex-modal-close {
            position: absolute;
            top: 0.5rem;
            right: 0.75rem;
            font-size: 1.5rem;
            cursor: pointer;
            color: #999;
        }
        .bibtex-modal-pre {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.85em;
            white-space: pre-wrap;
            margin-top: 1rem;
            border: 1px solid #eee;
        }
        .bibtex-copy-btn {
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background: #333;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 0.8em;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    function parseBibTeX(content) {
        const entries = [];
        const stringDefs = {};

        const stringPattern = /@string\s*\{\s*(\w+)\s*=\s*\{([^}]*)\}\s*\}/gi;
        let match;
        while ((match = stringPattern.exec(content)) !== null) {
            stringDefs[match[1].toLowerCase()] = match[2].trim();
        }

        // Extract entries
        const entryPattern = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
        while ((match = entryPattern.exec(content)) !== null) {
            const type = match[1].toLowerCase();
            const key = match[2];
            const startPos = match.index;

            if (['preamble', 'string', 'comment'].includes(type)) continue;

            let braceCount = 0, pos = startPos, foundFirstBrace = false, fieldsStart = -1;
            while (pos < content.length) {
                if (content[pos] === '{') {
                    if (!foundFirstBrace) {
                        foundFirstBrace = true;
                        fieldsStart = pos + 1;
                    }
                    braceCount++;
                } else if (content[pos] === '}') {
                    braceCount--;
                    if (foundFirstBrace && braceCount === 0) {
                        const fieldsContent = content.slice(fieldsStart, pos);
                        const rawContent = content.slice(startPos, pos + 1);
                        const fields = parseFields(fieldsContent);
                        entries.push({ type, key, fields, raw: rawContent });
                        break;
                    }
                }
                pos++;
            }
        }

        const entriesMap = new Map(entries.map(e => [e.key, e]));
        const usedCrossrefs = new Set();

        return entries.map(entry => {
            let fields = entry.fields;
            let raw = entry.raw;
            if (fields.crossref) {
                const parent = entriesMap.get(fields.crossref);
                if (parent) {
                    usedCrossrefs.add(fields.crossref);
                    fields = { ...parent.fields, ...fields };
                    raw = entry.raw + '\n\n' + parent.raw;
                }
            }
            return normalizeEntry(entry.type, entry.key, fields, raw, stringDefs);
        }).filter(e => e !== null && e.title && e.title !== 'Untitled' && !usedCrossrefs.has(e.key));
    }

    function parseFields(content) {
        const fields = {};
        const pattern = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\w+))/g;
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2] || match[3] || match[4] || '';
            fields[key] = key === 'note' ? value.trim() : cleanLatex(value.trim());
        }
        return fields;
    }

    function cleanLatex(text) {
        if (!text) return '';
        return text
            .replace(/\$\^[\{]?([^\$\}]+)[\}]?\$/g, '<sup>$1</sup>')
            .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
            .replace(/\$_[\{]?([^\$\}]+)[\}]?\$/g, '<sub>$1</sub>')
            .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
            .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2')
            .replace(/\\url\{([^}]*)\}/g, '$1')
            .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
            .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
            .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
            .replace(/\\&/g, '&')
            .replace(/\\\\/g, '')
            .replace(/[\{\}]/g, '')
            .replace(/\$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeEntry(type, key, fields, raw, stringDefs) {
        let venue = fields.booktitle || fields.journal || '';
        const venueKey = venue.toLowerCase();
        if (stringDefs[venueKey]) venue = stringDefs[venueKey];

        let finalUrl = fields.url || null;
        if (finalUrl) {
            finalUrl = finalUrl.replace(/\\url\{([^}]*)\}/g, '$1').replace(/[\{\}]/g, '');
        }

        let pdfUrl = null;
        if (fields.note) {
            const urlMatch = fields.note.match(/https?:\/\/[^\s}]+(?:pdf|html|org)?/i);
            if (urlMatch) {
                if (!finalUrl || urlMatch[0].toLowerCase().includes('.pdf')) {
                    pdfUrl = urlMatch[0];
                }
            }
        }
        const effectiveUrl = pdfUrl || finalUrl;

        if (fields.note) {
            fields.note = cleanLatex(fields.note);
        }

        let pubType = 'misc';
        const rawType = type.toLowerCase();
        if (rawType === 'inproceedings' || rawType === 'conference') pubType = 'conference';
        else if (rawType === 'article') pubType = 'journal';
        else if (rawType === 'book' || rawType === 'booklet' || rawType === 'incollection') pubType = 'book';
        else if (rawType === 'phdthesis' || rawType === 'mastersthesis') pubType = 'thesis';
        else if (rawType === 'techreport') pubType = 'techreport';

        if (rawType === 'misc' || rawType === 'unpublished') return null;

        return {
            key,
            type: pubType,
            title: fields.title || 'Untitled',
            authors: formatAuthors(fields.author || ''),
            year: parseInt(fields.year) || 0,
            venue: cleanLatex(venue),
            doi: fields.doi || null,
            url: effectiveUrl,
            raw: raw,
            awards: fields.note_award ? fields.note_award.split(';').map(a => cleanLatex(a.trim())).filter(Boolean) : []
        };
    }

    function formatAuthors(str) {
        if (!str) return '';
        return str.split(/\s+and\s+/i).map(a => {
            a = a.replace(/\$\^[^$]*\$/g, '').trim();
            if (a.includes(',')) {
                const parts = a.split(',').map(p => p.trim());
                return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : a;
            }
            return a;
        }).join(', ');
    }

    // Render functions
    let allPublications = [];

    function render(publications, searchQuery = '') {
        let filtered = publications;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = publications.filter(pub => {
                return (pub.title && pub.title.toLowerCase().includes(query)) ||
                    (pub.authors && pub.authors.toLowerCase().includes(query)) ||
                    (pub.venue && pub.venue.toLowerCase().includes(query));
            });
        }

        let html = '<div class="bibtex-group">';
        filtered.forEach(pub => {
            html += renderPub(pub);
        });
        html += '</div>';

        const searchHtml = `<div class="bibtex-search">
            <input type="text" placeholder="Search publications..." id="bibtex-search-input">
            ${searchQuery ? `<div class="bibtex-search-count">Showing ${filtered.length} of ${allPublications.length} publications</div>` : ''}
        </div>`;

        html += `<div class="bibtex-footer">
            Powered by <a href="https://roars.dev/bibtex/" target="_blank">BibTeX Parser</a>
        </div>`;

        container.innerHTML = searchHtml + html;

        container.addEventListener('click', (e) => {
            const bibtexBtn = e.target.closest('.bibtex-link');
            if (bibtexBtn) {
                const key = bibtexBtn.dataset.key;
                const pub = allPublications.find(p => p.key === key);
                if (pub && pub.raw) {
                    showModal(pub.raw);
                }
            }
        });

        const searchInput = container.querySelector('#bibtex-search-input');
        if (searchInput) {
            searchInput.value = searchQuery;
            searchInput.addEventListener('input', (e) => {
                render(allPublications, e.target.value);
            });
            if (searchQuery) {
                searchInput.focus();
                searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
            }
        }
    }

    function showModal(raw) {
        const modal = document.createElement('div');
        modal.className = 'bibtex-modal';
        modal.innerHTML = `
            <div class="bibtex-modal-content">
                <span class="bibtex-modal-close">&times;</span>
                <div style="font-weight: 600; font-size: 1.1em; margin-bottom: 0.5rem;">BibTeX Entry</div>
                <pre class="bibtex-modal-pre">${raw}</pre>
                <button class="bibtex-copy-btn">Copy to Clipboard</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.bibtex-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.querySelector('.bibtex-copy-btn').onclick = (e) => {
            navigator.clipboard.writeText(raw).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => e.target.textContent = 'Copy to Clipboard', 2000);
            });
        };
    }

    function renderPub(pub) {
        const typeLabels = {
            conference: 'Conf',
            journal: 'Journal',
            book: 'Book',
            thesis: 'Thesis',
            techreport: 'Tech Report',
            preprint: 'Preprint'
        };
        const badge = typeLabels[pub.type] ? `<span class="bibtex-badge">${typeLabels[pub.type]}</span>` : '';

        let titleHtml = pub.title;
        if (pub.url) {
            titleHtml = `<a href="${pub.url}" target="_blank">${pub.title}</a>`;
        } else if (pub.doi) {
            titleHtml = `<a href="https://doi.org/${pub.doi}" target="_blank">${pub.title}</a>`;
        }

        let links = '';
        if (pub.raw) {
            links += `<a href="#" class="bibtex-link" data-key="${pub.key}" onclick="return false;">BibTeX</a>`;
        }
        const pdfLink = pub.pdfUrl || pub.url;
        if (pdfLink) {
            links += `<a href="${pdfLink}" target="_blank">PDF</a>`;
        }
        if (pub.doi) links += `<a href="https://doi.org/${pub.doi}" target="_blank">DOI</a>`;

        return `<div class="bibtex-pub">
            <div class="bibtex-title">${titleHtml}${badge}</div>
            <div class="bibtex-authors">${pub.authors}</div>
            <div class="bibtex-venue">${pub.venue}${pub.year ? ` (${pub.year})` : ''}</div>
            ${pub.awards && pub.awards.length > 0 ? `
                <div class="bibtex-awards">
                    ${pub.awards.map(award => `<span class="bibtex-award">🏆 ${award}</span>`).join('')}
                </div>
            ` : ''}
            <div class="bibtex-links">${links}</div>
        </div>`;
    }

    // Fetch and parse
    async function load() {
        try {
            let response;
            try {
                response = await fetch(bibUrl);
                if (!response.ok) throw new Error('Direct fetch failed');
            } catch (e) {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(bibUrl)}`;
                response = await fetch(proxyUrl);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }

            const content = await response.text();
            const publications = parseBibTeX(content);

            if (publications.length === 0) {
                container.innerHTML = '<div class="bibtex-error">No publications found in the BibTeX file.</div>';
                return;
            }

            allPublications = publications;
            render(publications);
        } catch (err) {
            container.innerHTML = `<div class="bibtex-error">Error loading publications: ${err.message}</div>`;
            console.error('[BibTeX Embed]', err);
        }
    }

    load();
})();
