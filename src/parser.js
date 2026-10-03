// BibTeX parser and grouping utilities

// Publication types in display order. Tools (including benchmarks) and news are @misc entries
// tagged with a matching keyword; any other entry of an unknown type is dropped.
export const TYPES = [
  { id: 'conference', label: 'Conference', plural: 'Conference Papers' },
  { id: 'journal', label: 'Journal', plural: 'Journal Articles' },
  { id: 'book', label: 'Book', plural: 'Books' },
  { id: 'chapter', label: 'Book Chapter', plural: 'Book Chapters' },
  { id: 'techreport', label: 'Tech Report', plural: 'Technical Reports' },
  { id: 'thesis', label: 'Thesis', plural: 'Theses' },
  { id: 'preprint', label: 'Preprint', plural: 'Preprints' },
  { id: 'tool', label: 'Tool', plural: 'Tools, Projects & Benchmarks' },
  { id: 'news', label: 'News', plural: 'News' }
];

const BIBTEX_TYPES = {
  inproceedings: 'conference',
  conference: 'conference',
  article: 'journal',
  book: 'book',
  booklet: 'book',
  incollection: 'chapter',
  inbook: 'chapter',
  techreport: 'techreport',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  preprint: 'preprint',
  unpublished: 'preprint'
};

export function parseBibTeX(bibtexContent) {
  if (!bibtexContent || typeof bibtexContent !== 'string') return [];

  const stringDefs = extractStringDefinitions(bibtexContent);
  const rawEntries = extractEntries(bibtexContent);
  const entriesMap = new Map(rawEntries.map(e => [e.key, e]));
  const usedCrossrefs = new Set();

  const resolvedEntries = rawEntries.map(entry => {
    const parent = entriesMap.get(entry.fields.crossref);
    if (!parent) return entry;
    usedCrossrefs.add(parent.key);
    return {
      ...entry,
      fields: { ...parent.fields, ...entry.fields },
      raw: `${entry.raw}\n\n${parent.raw}`
    };
  });

  return resolvedEntries
    .filter(entry => !usedCrossrefs.has(entry.key))
    .map(entry => normalizeEntry(entry, stringDefs))
    .filter(Boolean);
}

export function extractStringDefinitions(content) {
  const defs = {};
  const stringPattern = /@string\s*\{\s*([\w-]+)\s*=\s*\{([^}]*)\}\s*\}/gi;

  for (const match of content.matchAll(stringPattern)) {
    defs[match[1].toLowerCase()] = match[2].trim();
  }

  return defs;
}

function extractEntries(content) {
  const entries = [];
  const entryPattern = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;

  for (const match of content.matchAll(entryPattern)) {
    const type = match[1].toLowerCase();
    if (['preamble', 'string', 'comment'].includes(type)) continue;

    const { fieldsContent, rawContent } = extractEntryContent(content, match.index);
    if (fieldsContent !== null) {
      entries.push({
        type,
        key: match[2],
        fields: parseFields(fieldsContent),
        raw: rawContent,
        index: entries.length
      });
    }
  }

  return entries;
}

// Returns the text between the entry's outermost braces, and the whole entry.
function extractEntryContent(content, startPos) {
  let depth = 0;
  let fieldsStart = -1;

  for (let pos = startPos; pos < content.length; pos++) {
    if (content[pos] === '{') {
      if (depth === 0) fieldsStart = pos + 1;
      depth++;
    } else if (content[pos] === '}') {
      depth--;
      if (fieldsStart !== -1 && depth === 0) {
        return {
          fieldsContent: content.slice(fieldsStart, pos),
          rawContent: content.slice(startPos, pos + 1)
        };
      }
    }
  }

  return { fieldsContent: null, rawContent: null };
}

function parseFields(content) {
  const fields = {};
  const fieldPattern = /([\w-]+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|([\w-]+))/g;

  for (const match of content.matchAll(fieldPattern)) {
    const value = (match[2] || match[3] || match[4] || '').trim();
    const key = match[1].toLowerCase();
    fields[key] = key === 'note' ? value : cleanLatex(value);
  }

  return fields;
}

const LATEX_RULES = [
  [/\$\^\{?([^$}]+)\}?\$/g, '<sup>$1</sup>'],
  [/\^\{([^}]+)\}/g, '<sup>$1</sup>'],
  [/\^([0-9a-zA-Z]+)/g, '<sup>$1</sup>'],
  [/\$_\{?([^$}]+)\}?\$/g, '<sub>$1</sub>'],
  [/_\{([^}]+)\}/g, '<sub>$1</sub>'],
  [/_([0-9a-zA-Z]+)/g, '<sub>$1</sub>'],
  [/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2'],
  [/\\url\{([^}]*)\}/g, '$1'],
  [/\\&/g, '&'],
  [/\\\\/g, ''],
  [/\\'/g, "'"],
  [/\\"/g, '"'],
  [/\\`/g, '`'],
  [/\\~/g, '~'],
  [/\\textit\{([^}]*)\}/g, '<em>$1</em>'],
  [/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>'],
  [/\\emph\{([^}]*)\}/g, '<em>$1</em>'],
  [/[{}]/g, ''],
  [/\$/g, ''],
  [/\\coe/g, '*'],
  [/\s+/g, ' ']
];

export function cleanLatex(text) {
  if (!text) return '';
  return LATEX_RULES.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), text).trim();
}

export function formatAuthors(authorString) {
  if (!authorString) return '';

  return authorString
    .split(/\s+and\s+/i)
    .map(author => {
      const name = cleanLatex(author);
      const [last, first] = name.split(',').map(p => p.trim());
      return first ? `${first} ${last}` : name;
    })
    .join(', ');
}

const KEYWORD_TYPES = { tool: 'tool', benchmark: 'tool', news: 'news' };

function classify(rawType, venue, fields) {
  const isPreprint = /arxiv|preprint/i.test(venue) ||
    /arxiv/i.test(fields.archiveprefix || '') ||
    Boolean(fields.eprint);
  if (isPreprint) return 'preprint';
  if (BIBTEX_TYPES[rawType]) return BIBTEX_TYPES[rawType];

  const keywords = (fields.keywords || '').toLowerCase().split(',').map(k => k.trim());
  const match = keywords.find(k => KEYWORD_TYPES[k]);
  return match ? KEYWORD_TYPES[match] : null;
}

// Returns null for entries whose type is not in TYPES.
export function normalizeEntry(entry, stringDefs = {}) {
  const fields = entry.fields || {};

  let venue = fields.booktitle || fields.journal || '';
  venue = stringDefs[venue.toLowerCase()] || venue;
  venue = venue.replace(/#\s*"-?/g, ' ').replace(/-?"/g, '').trim();

  const type = classify((entry.type || '').toLowerCase(), venue, fields);
  if (!type) return null;

  // A URL in the note takes precedence over the url field.
  const noteUrl = fields.note?.match(/https?:\/\/[^\s}]+/i)?.[0];
  const typeIndex = TYPES.findIndex(t => t.id === type);

  return {
    key: entry.key,
    type,
    typePriority: typeIndex,
    title: fields.title || 'Untitled',
    authors: formatAuthors(fields.author),
    year: parseInt(fields.year, 10) || 0,
    venue: cleanLatex(venue),
    pages: fields.pages || '',
    doi: fields.doi || null,
    eprint: fields.eprint || null,
    url: noteUrl || fields.url || null,
    awards: splitList(fields.note_award, ';'),
    keywords: splitList(fields.keywords, ','),
    publisher: fields.publisher || null,
    volume: fields.volume || null,
    number: fields.number || null,
    originalIndex: entry.index ?? 0,
    raw: entry.raw || ''
  };
}

function splitList(value, separator) {
  return value ? value.split(separator).map(s => cleanLatex(s.trim())).filter(Boolean) : [];
}

export function groupByYear(publications) {
  const grouped = Map.groupBy(publications, pub => pub.year || 'Unknown');

  return [...grouped]
    .sort(([a], [b]) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0))
    .map(([year, pubs]) => ({
      label: String(year),
      publications: pubs.slice().sort((a, b) => a.typePriority - b.typePriority)
    }));
}

export function groupByType(publications) {
  const grouped = Map.groupBy(publications, pub => pub.type);

  return TYPES
    .filter(({ id }) => grouped.has(id))
    .map(({ id, plural }) => ({
      label: plural,
      publications: grouped.get(id).slice().sort((a, b) => b.year - a.year)
    }));
}

export function groupByDefault(publications) {
  return [{
    label: 'All Publications',
    publications: publications.slice().sort((a, b) => a.originalIndex - b.originalIndex)
  }];
}
