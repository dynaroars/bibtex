import { parseBibTeX, groupByYear, groupByType } from './parser.js';
import { parseCSV } from './csvParser.js';
import { renderPublications, updateStats } from './renderer.js';

// State
let currentFileType = 'bib';
let currentPublications = [];
let currentGrouping = 'year';
let searchQuery = '';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const publicationsContainer = document.getElementById('publications-container');
const filtersSection = document.getElementById('filtersSection');
const loadingOverlay = document.getElementById('loadingOverlay');
const groupButtons = document.querySelectorAll('.group-btn');
const exportFormat = document.getElementById('exportFormat');
const searchInput = document.getElementById('searchInput');

function init() {
    setupEventListeners();

    const params = new URLSearchParams(window.location.search);
    const bibUrl = params.get('bib');
    if (bibUrl) {
        urlInput.value = bibUrl;
        loadFromUrl(bibUrl);
    }
}

function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            fileInput.click();
        }
    });

    loadUrlBtn.addEventListener('click', () => loadFromUrl(urlInput.value));
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadFromUrl(urlInput.value);
    });

    groupButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            groupButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGrouping = btn.dataset.group;
            displayPublications();
        });
    });

    exportFormat.addEventListener('change', (e) => {
        if (e.target.value && currentPublications.length > 0) {
            exportPublications(e.target.value);
            e.target.value = '';
        }
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        displayPublications();
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) readFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.bib') || file.name.endsWith('.bibtex') || file.name.endsWith('.csv'))) {
        readFile(file);
    } else {
        showError('Please drop a valid .bib or .csv file');
    }
}

function readFile(file) {
    showLoading(true);
    currentFileType = file.name.endsWith('.csv') ? 'csv' : 'bib';

    const reader = new FileReader();
    reader.onload = (e) => processContent(e.target.result, currentFileType);
    reader.onerror = () => {
        showLoading(false);
        showError('Failed to read file');
    };
    reader.readAsText(file);
}

async function loadFromUrl(url) {
    if (!url) {
        showError('Please enter a URL');
        return;
    }

    try {
        new URL(url);
    } catch {
        showError('Please enter a valid URL');
        return;
    }

    currentFileType = url.toLowerCase().endsWith('.csv') ? 'csv' : 'bib';
    showLoading(true);

    try {
        let response;
        let lastError;

        // Try direct fetch first
        try {
            response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (e) {
            lastError = e;
            response = null;
        }

        // Try AllOrigins proxy
        if (!response) {
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } catch (e) {
                lastError = e;
                response = null;
            }
        }

        // Try CORSProxy.io as backup
        if (!response) {
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } catch (e) {
                lastError = e;
                response = null;
            }
        }

        if (!response) {
            throw lastError || new Error('Failed to fetch from all sources');
        }

        const content = await response.text();
        processContent(content, currentFileType);
    } catch (error) {
        showLoading(false);
        showError(`Failed to load file: ${error.message}`);
    }
}

function processContent(content, fileType) {
    try {
        currentPublications = fileType === 'csv' ? parseCSV(content) : parseBibTeX(content);

        if (currentPublications.length === 0) {
            showLoading(false);
            showError(`No publications found in the ${fileType.toUpperCase()} file`);
            return;
        }

        updateStats(currentPublications);
        displayPublications();
        filtersSection.style.display = 'flex';
        showLoading(false);
    } catch (error) {
        showLoading(false);
        showError(`Failed to parse ${fileType.toUpperCase()}: ${error.message}`);
        console.error('Parse error:', error);
    }
}

function displayPublications() {
    let filteredPubs = currentPublications;

    if (searchQuery) {
        filteredPubs = currentPublications.filter(pub => {
            const searchFields = [
                pub.title,
                pub.authors,
                pub.venue,
                pub.year?.toString(),
                pub.type
            ].filter(Boolean).join(' ').toLowerCase();

            return searchFields.includes(searchQuery);
        });
    }

    const groups = currentGrouping === 'year'
        ? groupByYear(filteredPubs)
        : groupByType(filteredPubs);
    renderPublications(groups, publicationsContainer);

    const countEl = document.getElementById('searchCount');
    if (countEl) {
        countEl.textContent = searchQuery
            ? `Showing ${filteredPubs.length} of ${currentPublications.length}`
            : '';
    }
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function showError(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 1rem 2rem;
        background: #333;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function exportPublications(format) {
    let content, filename, mimeType;

    switch (format) {
        case 'json':
            content = JSON.stringify(currentPublications, null, 2);
            filename = 'publications.json';
            mimeType = 'application/json';
            break;
        case 'bibtex':
            content = exportToBibTeX(currentPublications);
            filename = 'publications.bib';
            mimeType = 'text/plain';
            break;
        case 'csv':
            content = exportToCSV(currentPublications);
            filename = 'publications.csv';
            mimeType = 'text/csv';
            break;
        default:
            return;
    }

    downloadFile(content, filename, mimeType);
}

function exportToBibTeX(publications) {
    return publications.map(pub => {
        const entryType = pub.type === 'article' ? 'article' :
            pub.type === 'conference' ? 'inproceedings' : 'misc';

        let entry = `@${entryType}{${pub.key},\n`;
        entry += `  title = {${pub.title}},\n`;
        entry += `  author = {${pub.authors}},\n`;
        if (pub.year) entry += `  year = {${pub.year}},\n`;
        if (pub.venue) {
            if (pub.type === 'article') {
                entry += `  journal = {${pub.venue}},\n`;
            } else {
                entry += `  booktitle = {${pub.venue}},\n`;
            }
        }
        if (pub.pages) entry += `  pages = {${pub.pages}},\n`;
        if (pub.doi) entry += `  doi = {${pub.doi}},\n`;
        if (pub.url) entry += `  url = {${pub.url}},\n`;
        if (pub.volume) entry += `  volume = {${pub.volume}},\n`;
        if (pub.number) entry += `  number = {${pub.number}},\n`;
        if (pub.publisher) entry += `  publisher = {${pub.publisher}},\n`;
        entry += `}\n`;
        return entry;
    }).join('\n');
}

function exportToCSV(publications) {
    const headers = ['Title', 'Authors', 'Year', 'Type', 'Venue', 'Pages', 'DOI', 'URL'];
    const rows = publications.map(pub => [
        `"${(pub.title || '').replace(/"/g, '""')}"`,
        `"${(pub.authors || '').replace(/"/g, '""')}"`,
        pub.year || '',
        pub.type || '',
        `"${(pub.venue || '').replace(/"/g, '""')}"`,
        pub.pages || '',
        pub.doi || '',
        pub.url || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

init();
