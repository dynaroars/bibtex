import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBibTeX,
  cleanLatex,
  formatAuthors,
  groupByYear,
  groupByType,
  groupByOriginal,
  groupByDefault,
  extractStringDefinitions
} from '../src/parser.js';

test('cleanLatex strips and converts LaTeX markup', () => {
  assert.equal(cleanLatex('\\textbf{Hello} \\textit{World}'), '<strong>Hello</strong> <em>World</em>');
  assert.equal(cleanLatex('A \\& B'), 'A & B');
  assert.equal(cleanLatex('Author$^1$ and Author$^2$'), 'Author<sup>1</sup> and Author<sup>2</sup>');
  assert.equal(cleanLatex('x_1 and y_{sub}'), 'x<sub>1</sub> and y<sub>sub</sub>');
  assert.equal(cleanLatex('\\href{https://example.com}{Link text}'), 'Link text');
  assert.equal(cleanLatex('{Enclosed in braces}'), 'Enclosed in braces');
});

test('formatAuthors normalizes author strings', () => {
  assert.equal(formatAuthors('Nguyen, ThanhVu and Dwyer, Matthew'), 'ThanhVu Nguyen, Matthew Dwyer');
  assert.equal(formatAuthors('John Doe and Jane Smith'), 'John Doe, Jane Smith');
  assert.equal(formatAuthors('Doe, John$^1$ and Smith, Jane$^2$'), 'John Doe, Jane Smith');
  assert.equal(formatAuthors(''), '');
});

test('extractStringDefinitions parses macros correctly', () => {
  const bib = `
    @string{icse = {International Conference on Software Engineering (ICSE)}}
    @string{pldi = {Programming Language Design and Implementation (PLDI)}}
  `;
  const defs = extractStringDefinitions(bib);
  assert.equal(defs.icse, 'International Conference on Software Engineering (ICSE)');
  assert.equal(defs.pldi, 'Programming Language Design and Implementation (PLDI)');
});

test('parseBibTeX parses basic entries and expands strings', () => {
  const bib = `
    @string{icse = {International Conference on Software Engineering (ICSE)}}

    @inproceedings{smith2024test,
      title = {Automated Testing with AI},
      author = {Smith, Jane and Doe, John},
      booktitle = icse,
      year = {2024},
      pages = {100--112},
      doi = {10.1145/1234567.890}
    }
  `;

  const pubs = parseBibTeX(bib);
  assert.equal(pubs.length, 1);

  const p = pubs[0];
  assert.equal(p.key, 'smith2024test');
  assert.equal(p.type, 'conference');
  assert.equal(p.title, 'Automated Testing with AI');
  assert.equal(p.authors, 'Jane Smith, John Doe');
  assert.equal(p.year, 2024);
  assert.equal(p.venue, 'International Conference on Software Engineering (ICSE)');
  assert.equal(p.doi, '10.1145/1234567.890');
});

test('parseBibTeX resolves cross-references', () => {
  const bib = `
    @inproceedings{entryChild,
      author = {Ishimwe, Didier and Nguyen, ThanhVu},
      crossref = {entryParent},
      note = {\\href{https://roars.dev/pubs/test.pdf}{PDF}}
    }

    @inproceedings{entryParent,
      title = {LLM-Guided Fuzzing},
      author = {Ishimwe, Didier and Nguyen, ThanhVu},
      booktitle = {SBST},
      year = {2025}
    }
  `;

  const pubs = parseBibTeX(bib);
  assert.equal(pubs.length, 1);
  assert.equal(pubs[0].key, 'entryChild');
  assert.equal(pubs[0].title, 'LLM-Guided Fuzzing');
  assert.equal(pubs[0].year, 2025);
  assert.equal(pubs[0].venue, 'SBST');
  assert.equal(pubs[0].pdfUrl, 'https://roars.dev/pubs/test.pdf');
});

test('parseBibTeX handles preprints and arXiv identifiers', () => {
  const bib = `
    @misc{paper2023arxiv,
      title = {A Novel Method},
      author = {Doe, John},
      year = {2023},
      eprint = {2306.15584},
      archivePrefix = {arXiv}
    }
  `;

  const pubs = parseBibTeX(bib);
  assert.equal(pubs.length, 1);
  assert.equal(pubs[0].type, 'preprint');
  assert.equal(pubs[0].eprint, '2306.15584');
});

test('parseBibTeX handles full realistic multi-entry corpus', () => {
  const bib = `
    @string{tse = {IEEE Transactions on Software Engineering}}
    @string{icse = {International Conference on Software Engineering}}

    @article{journalPaper,
      title = {Invariant Generation with Symbolic Execution},
      author = {Nguyen, ThanhVu and Kapur, Deepak},
      journal = tse,
      year = {2022},
      volume = {48},
      number = {5},
      pages = {1234--1248},
      keywords = {invariants, formal-methods}
    }

    @book{textbook,
      title = {Principles of Program Analysis},
      author = {Nielson, Flemming and Nielson, Hanne R.},
      year = {2019},
      publisher = {Springer}
    }

    @phdthesis{phdDoc,
      title = {Automatic Program Invariant Discovery},
      author = {Nguyen, ThanhVu},
      year = {2014},
      school = {University of New Mexico}
    }
  `;

  const pubs = parseBibTeX(bib);
  assert.equal(pubs.length, 3);
  assert.equal(pubs[0].type, 'journal');
  assert.equal(pubs[1].type, 'book');
  assert.equal(pubs[2].type, 'thesis');
  assert.deepEqual(pubs[0].keywords, ['invariants', 'formal-methods']);
});

test('groupByYear, groupByType, and groupByOriginal group correctly', () => {
  const pubs = [
    { key: 'p1', title: 'Paper 1', year: 2024, type: 'conference', typePriority: 1, originalIndex: 0 },
    { key: 'p2', title: 'Paper 2', year: 2024, type: 'journal', typePriority: 2, originalIndex: 1 },
    { key: 'p3', title: 'Paper 3', year: 2023, type: 'conference', typePriority: 1, originalIndex: 2 }
  ];

  const yearGroups = groupByYear(pubs);
  assert.equal(yearGroups.length, 2);
  assert.equal(yearGroups[0].year, '2024');
  assert.equal(yearGroups[0].publications.length, 2);

  const typeGroups = groupByType(pubs);
  assert.equal(typeGroups.length, 2);
  assert.equal(typeGroups[0].year, 'Conference Papers');
  assert.equal(typeGroups[0].publications.length, 2);

  const originalGroups = groupByOriginal(pubs);
  assert.equal(originalGroups.length, 1);
  assert.equal(originalGroups[0].publications.length, 3);

  const defaultGroups = groupByDefault(pubs);
  assert.deepEqual(defaultGroups, originalGroups);
});

test('handles empty and invalid input gracefully', () => {
  assert.deepEqual(parseBibTeX(''), []);
  assert.deepEqual(parseBibTeX(null), []);
  assert.deepEqual(parseBibTeX(undefined), []);
  assert.deepEqual(parseBibTeX('not a bibtex string'), []);
});
