// CSV Parser

export function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    const columnMap = {
        title: findColumn(headers, ['title', 'paper', 'paper title']),
        authors: findColumn(headers, ['author', 'authors', 'author(s)']),
        year: findColumn(headers, ['year', 'date', 'publication year', 'pub year']),
        venue: findColumn(headers, ['venue', 'journal', 'conference', 'booktitle', 'publication']),
        type: findColumn(headers, ['type', 'publication type', 'entry type']),
        doi: findColumn(headers, ['doi']),
        url: findColumn(headers, ['url', 'link']),
        pages: findColumn(headers, ['pages', 'page']),
        volume: findColumn(headers, ['volume', 'vol']),
        number: findColumn(headers, ['number', 'issue']),
        publisher: findColumn(headers, ['publisher']),
        abstract: findColumn(headers, ['abstract']),
    };

    const publications = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const pub = createPublication(values, columnMap, i);

        if (pub.title) publications.push(pub);
    }

    return publications;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());

    return values;
}

function findColumn(headers, possibleNames) {
    for (const name of possibleNames) {
        const index = headers.indexOf(name);
        if (index !== -1) return index;
    }
    return -1;
}

function createPublication(values, columnMap, index) {
    const getValue = (col) => (col >= 0 && col < values.length) ? values[col] : '';

    const title = getValue(columnMap.title);
    const authorsRaw = getValue(columnMap.authors);
    const yearRaw = getValue(columnMap.year);
    const venue = getValue(columnMap.venue);
    const typeRaw = getValue(columnMap.type);

    let year = 0;
    if (yearRaw) {
        const yearMatch = yearRaw.match(/\d{4}/);
        if (yearMatch) year = parseInt(yearMatch[0]);
    }

    let pubType = 'misc';
    const typeLower = typeRaw.toLowerCase();
    if (typeLower.includes('conference') || typeLower.includes('inproceedings')) {
        pubType = 'conference';
    } else if (typeLower.includes('article') || typeLower.includes('journal')) {
        pubType = 'article';
    } else if (typeLower.includes('preprint') || typeLower.includes('arxiv')) {
        pubType = 'preprint';
    }

    const authors = formatCSVAuthors(authorsRaw);

    return {
        key: `csv_entry_${index}`,
        type: pubType,
        title: title || 'Untitled',
        authors,
        year,
        venue,
        pages: getValue(columnMap.pages),
        doi: getValue(columnMap.doi) || null,
        url: getValue(columnMap.url) || null,
        pdfUrl: null,
        eprint: null,
        publisher: getValue(columnMap.publisher) || null,
        volume: getValue(columnMap.volume) || null,
        number: getValue(columnMap.number) || null,
    };
}

function formatCSVAuthors(authorString) {
    if (!authorString) return '';

    let authors = authorString
        .split(/\s*;\s*|\s+and\s+/i)
        .map(a => a.trim())
        .filter(a => a.length > 0);

    if (authors.length === 1 && authors[0].includes(',')) {
        const parts = authors[0].split(',').map(p => p.trim());
        if (parts.length > 2) authors = parts;
    }

    return authors.join(', ');
}
