// BibTeX Parser

export function parseBibTeX(bibtexContent) {
    const stringDefs = extractStringDefinitions(bibtexContent);
    const rawEntries = extractEntries(bibtexContent);
    const entriesMap = new Map(rawEntries.map(e => [e.key, e]));
    const usedCrossrefs = new Set();

    const resolvedEntries = rawEntries.map(entry => {
        if (entry.fields.crossref) {
            const parentKey = entry.fields.crossref;
            const parent = entriesMap.get(parentKey);
            if (parent) {
                usedCrossrefs.add(parentKey);
                return {
                    ...entry,
                    fields: { ...parent.fields, ...entry.fields }
                };
            }
        }
        return entry;
    });

    return resolvedEntries
        .filter(entry => !usedCrossrefs.has(entry.key))
        .map(entry => normalizeEntry(entry, stringDefs))
        .filter(entry => entry !== null);
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
    let index = 0;

    while ((match = entryPattern.exec(content)) !== null) {
        const type = match[1].toLowerCase();
        const key = match[2];
        const startPos = match.index + match[0].length;

        if (['preamble', 'string', 'comment'].includes(type)) continue;

        const fieldsContent = extractFieldsContent(content, startPos);
        if (fieldsContent) {
            const fields = parseFields(fieldsContent);
            entries.push({ type, key, fields, index: index++ });
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
        .replace(/\\&/g, '&')
        .replace(/\\\\/g, '')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\`/g, '`')
        .replace(/\\~/g, '~')
        .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
        .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
        .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
        .replace(/[\{\}]/g, '')
        .replace(/\$/g, '')
        .replace(/\\coe/g, '*')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeEntry(entry, stringDefs) {
    const fields = entry.fields;

    let venue = fields.booktitle || fields.journal || '';
    const venueKey = venue.toLowerCase();
    if (stringDefs[venueKey]) venue = stringDefs[venueKey];
    venue = venue.replace(/#\s*"-?/g, ' ').replace(/-?"/g, '').trim();

    let pdfUrl = fields.url || null;
    if (fields.note) {
        const urlMatch = fields.note.match(/https?:\/\/[^\s}]+(?:pdf|html|org)?/i);
        if (urlMatch) pdfUrl = urlMatch[0];
    }

    if (!pdfUrl && fields.note && fields.note.includes('http')) {
        const match = fields.note.match(/(https?:\/\/[^\s]+)/);
        if (match) pdfUrl = match[1];
    }


    let pubType = 'misc';
    const rawType = entry.type.toLowerCase();

    if (rawType === 'inproceedings' || rawType === 'conference') {
        pubType = 'conference';
    } else if (rawType === 'article') {
        pubType = 'journal';
    } else if (rawType === 'book' || rawType === 'booklet' || rawType === 'incollection') {
        pubType = 'book';
    } else if (rawType === 'techreport') {
        pubType = 'techreport';
    } else if (rawType === 'phdthesis' || rawType === 'mastersthesis') {
        pubType = 'thesis';
    }

    if (rawType === 'misc' || rawType === 'unpublished') {
        return null;
    }

    let finalUrl = fields.url || null;
    if (finalUrl) {
        finalUrl = finalUrl.replace(/\\url\{([^}]*)\}/g, '$1').replace(/[\{\}]/g, '');
    }

    if (fields.note) {
        const urlMatch = fields.note.match(/https?:\/\/[^\s}]+(?:pdf|html|org)?/i);
        if (urlMatch) {
            if (!finalUrl || urlMatch[0].toLowerCase().includes('.pdf')) {
                pdfUrl = urlMatch[0];
            }
        }
    }

    const effectiveUrl = pdfUrl || finalUrl;

    const typePriority = {
        'book': 0,  
        'conference': 1,
        'journal': 2,
        'techreport': 3,
        'thesis': 4,
        'preprint': 5,
        'misc': 6
    };

    return {
        key: entry.key,
        type: pubType,
        typePriority: typePriority[pubType] || 99,
        title: fields.title || 'Untitled',
        authors: formatAuthors(fields.author || ''),
        year: parseInt(fields.year) || 0,
        venue: cleanLatex(venue),
        pages: fields.pages || '',
        doi: fields.doi || null,
        url: effectiveUrl,
        note: fields.note ? cleanLatex(fields.note) : null,
        awards: fields.note_award ? fields.note_award.split(';').map(a => cleanLatex(a.trim())).filter(Boolean) : [],
        publisher: fields.publisher || null,
        volume: fields.volume || null,
        number: fields.number || null,
        originalIndex: entry.index
    };
}

function formatAuthors(authorString) {
    if (!authorString) return '';

    const authors = authorString.split(/\s+and\s+/i);

    return authors.map(author => {
        author = author.replace(/\$\^[^$]*\$/g, '').trim(); // Remove math superscripts

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

    return sortedYears.map(year => {
        const pubsInYear = grouped[year].sort((a, b) => {
            return a.typePriority - b.typePriority;
        });

        return {
            year,
            publications: pubsInYear
        };
    });
}

export function groupByType(publications) {
    const typeNames = {
        book: 'Books',
        journal: 'Journal Articles',
        conference: 'Conference Papers',
        preprint: 'Preprints',
        techreport: 'Technical Reports',
        thesis: 'Theses',
        misc: 'Other'
    };

    const grouped = {};

    publications.forEach(pub => {
        const type = pub.type || 'misc';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(pub);
    });

    // Explicit order: Conference, Journal, Tech Report, Preprint, Misc
    const order = ['book', 'conference', 'journal', 'techreport', 'thesis', 'preprint', 'misc'];

    return order
        .filter(type => grouped[type] && grouped[type].length > 0)
        .map(type => ({
            year: typeNames[type] || type, // Reusing 'year' property for section title to keep renderer simple
            publications: grouped[type].sort((a, b) => (b.year || 0) - (a.year || 0))
        }));
}

export function groupByOriginal(publications) {
    return [{
        year: 'All Publications',
        publications: publications.sort((a, b) => (a.originalIndex || 0) - (b.originalIndex || 0))
    }];
}
