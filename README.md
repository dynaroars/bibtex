# BibTeX Parser

Parse and display your academic publications.  See demo at https://roars.dev/bibtex/?bib=https://raw.githubusercontent.com/dynaroars/latex-cv/main/cv.bib.

## Features

- **File Upload** - Drag & drop or browse for `.bib` or `.csv` files
- **URL Loading** - Load BibTeX directly from a URL
- **Grouping** - View publications by Year or Type
- **Export** - Download as JSON, BibTeX, or CSV

## Usage

### Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

### Load via URL Parameter

```
http://localhost:5173/?bib=https://example.com/publications.bib
```

### Supported File Formats

**BibTeX (.bib)**
- Standard BibTeX entries (article, inproceedings, misc, etc.)
- Entries with `crossref` field are automatically filtered out

**CSV (.csv)**
- Headers: `title`, `authors`, `year`, `venue`, `type`, `doi`, `url`, `pages`
- Flexible column name matching

## Export Formats

| Format | Description |
|--------|-------------|
| JSON | Full structured data |
| BibTeX | Standard `.bib` format |
| CSV | Spreadsheet-compatible |

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Tech

- Vanilla JavaScript (ES Modules)
- Vite
- Custom BibTeX/CSV parsers

## License

MIT
