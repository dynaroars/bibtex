// BibTeX Parser

export function parseBibTeX(bibtexContent) {
    const stringDefs = extractStringDefinitions(bibtexContent);
    const entries = extractEntries(bibtexContent);

    return entries
        .filter(entry => !entry.fields.crossref)
        .map(entry => normalizeEntry(entry, stringDefs));
}

function extractStringDefinitions(content) {
    const defs = {};
    const stringPattern = /@string\s*\{\s*(\w+)\s*=\s*\{([^}]*)\}\s*\}/gi;
    let match;

    while ((match = stringPattern.exec(content)) !== null) {
        defs[match[1].toLowerCase()] = match[2].trim();
    }

    return defs;
}

function extractEntries(content) {
    const entries = [];
    const entryPattern = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
    let match;

    while ((match = entryPattern.exec(content)) !== null) {
        const type = match[1].toLowerCase();
        const key = match[2];
        const startPos = match.index + match[0].length;

        if (['preamble', 'string', 'comment'].includes(type)) continue;

        const fieldsContent = extractFieldsContent(content, startPos);
        if (fieldsContent) {
            const fields = parseFields(fieldsContent);
            entries.push({ type, key, fields });
        }
    }

    return entries;
}

function extractFieldsContent(content, startPos) {
    let braceCount = 1;
    let pos = startPos;

    while (pos < content.length && braceCount > 0) {
        if (content[pos] === '{') braceCount++;
        else if (content[pos] === '}') braceCount--;
        pos++;
    }

    return braceCount === 0 ? content.slice(startPos, pos - 1) : null;
}

function parseFields(content) {
    const fields = {};
    const fieldPattern = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\w+))/g;
    let match;

    while ((match = fieldPattern.exec(content)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2] || match[3] || match[4] || '';
        fields[key] = cleanLatex(value.trim());
    }

    return fields;
}

function cleanLatex(text) {
    return text
        .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
        .replace(/\\&/g, '&')
        .replace(/\\\\/g, '')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\`/g, '`')
        .replace(/\\~/g, '~')
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\$/g, '')
        .replace(/\\coe\{[^}]*\}/g, '')
        .replace(/\\tseif/g, '')
        .replace(/\\newcommand[^}]*\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeEntry(entry, stringDefs) {
    const fields = entry.fields;

    let venue = fields.booktitle || fields.journal || '';
    const venueKey = venue.toLowerCase();
    if (stringDefs[venueKey]) venue = stringDefs[venueKey];
    venue = venue.replace(/#\s*"-?/g, ' ').replace(/-?"/g, '').trim();

    let pdfUrl = null;
    if (fields.note) {
        const pdfMatch = fields.note.match(/https?:\/\/[^\s}]+\.pdf/i);
        if (pdfMatch) pdfUrl = pdfMatch[0];
    }

    let pubType = 'misc';
    if (entry.type === 'inproceedings' || entry.type === 'conference') {
        pubType = 'conference';
    } else if (entry.type === 'article') {
        pubType = 'article';
    } else if (entry.type === 'misc' && fields.eprint) {
        pubType = 'preprint';
    }

    return {
        key: entry.key,
        type: pubType,
        title: fields.title || 'Untitled',
        authors: formatAuthors(fields.author || ''),
        year: parseInt(fields.year) || 0,
        venue: cleanLatex(venue),
        pages: fields.pages || '',
        doi: fields.doi || null,
        url: fields.url || null,
        pdfUrl,
        eprint: fields.eprint || null,
        publisher: fields.publisher || null,
        volume: fields.volume || null,
        number: fields.number || null,
    };
}

function formatAuthors(authorString) {
    if (!authorString) return '';

    const authors = authorString.split(/\s+and\s+/i);

    return authors.map(author => {
        author = author.replace(/\$\^[^$]*\$/g, '').trim();

        if (author.includes(',')) {
            const parts = author.split(',').map(p => p.trim());
            if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
        }

        return author;
    }).join(', ');
}

// Grouping functions
export function groupByYear(publications) {
    const grouped = {};

    publications.forEach(pub => {
        const year = pub.year || 'Unknown';
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(pub);
    });

    const sortedYears = Object.keys(grouped)
        .sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0));

    return sortedYears.map(year => ({
        year,
        publications: grouped[year]
    }));
}

export function groupByType(publications) {
    const typeNames = {
        article: 'Journal Articles',
        conference: 'Conference Papers',
        preprint: 'Preprints',
        misc: 'Other'
    };

    const grouped = {};

    publications.forEach(pub => {
        const type = pub.type || 'misc';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(pub);
    });

    const typePriority = ['article', 'conference', 'preprint', 'misc'];

    return typePriority
        .filter(type => grouped[type])
        .map(type => ({
            year: typeNames[type] || type,
            publications: grouped[type].sort((a, b) => (b.year || 0) - (a.year || 0))
        }));
}
