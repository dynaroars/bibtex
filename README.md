# BibTeX Viewer

A fast, minimal, zero-dependency viewer and search tool for academic BibTeX publications.

**Live Demo**: [bibtex.roars.dev](https://bibtex.roars.dev/?bib=https://tvn.roars.dev/cv/cv.bib)

## Features

- **BibTeX Loading** — Load from any `.bib` URL or upload / drag-and-drop a `.bib` file
- **Instant Search** — Live filtering by title, author, venue, year, or `#tag`
- **Flexible Grouping** — Group publications by Default order, Year, or Publication Type
- **Preprint Filter** — One-click toggle to hide preprints and arXiv drafts
- **Minimalist Design** — Clean typography, automatic dark/light theme, and back-to-top navigation
- **Search Engine Friendly** — Full SEO metadata, Open Graph previews, and Schema.org structured data

## Development

```bash
npm install
npm run dev      # Start Vite dev server
npm test         # Run unit tests (Node.js test runner)
npm run build    # Build for production
```

## Tech Stack

- **Vanilla JavaScript** (ES Modules, 0 runtime dependencies)
- **Vite** (bundling & dev server)
- **Node.js Native Test Runner** (`node:test`)
- **GitHub Actions** (automated testing & deployment)

## License

MIT
