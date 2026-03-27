// ─── TOOLZONE — Homepage Script ─────────────────────────────────────────────
// Handles: Live search across all tools

const ALL_TOOLS = [
  // PDF
  { name: 'PDF Merger',     desc: 'Combine multiple PDFs into one',         icon: '🔗', tag: 'Popular', href: 'tools/pdf-merger/index.html',      accent: '#fc5c7d' },
  { name: 'PDF Splitter',   desc: 'Extract specific pages from a PDF',       icon: '✂️', href: 'tools/pdf-splitter/index.html',    accent: '#fc5c7d' },
  { name: 'PDF Compressor', desc: 'Reduce PDF size without quality loss',    icon: '🗜️', href: 'tools/pdf-compressor/index.html',  accent: '#fc5c7d' },
  { name: 'Image to PDF',   desc: 'Convert JPG/PNG into a PDF file',         icon: '🖼️', tag: 'Free',    href: 'tools/image-to-pdf/index.html',    accent: '#fc5c7d' },
  { name: 'PDF to Text',    desc: 'Extract all readable text from a PDF',    icon: '📝', href: 'tools/pdf-to-text/index.html',     accent: '#fc5c7d' },
  { name: 'PDF Password',   desc: 'Protect PDF with a password',             icon: '🔐', href: 'tools/pdf-password/index.html',    accent: '#fc5c7d' },

  // Image
  { name: 'Image Compressor', desc: 'Reduce image size, keep quality',       icon: '🗜️', tag: 'Popular', href: 'tools/image-compressor/index.html',  accent: '#7c5cfc' },
  { name: 'Image Resizer',    desc: 'Resize to exact pixels or percentage',  icon: '📐', href: 'tools/image-resizer/index.html',    accent: '#7c5cfc' },
  { name: 'Format Converter', desc: 'Convert between JPG, PNG, WebP',        icon: '🔄', href: 'tools/image-converter/index.html',  accent: '#7c5cfc' },
  { name: 'Add Watermark',    desc: 'Add text watermark to any image',        icon: '💧', href: 'tools/image-watermark/index.html',  accent: '#7c5cfc' },
  { name: 'Image to Base64',  desc: 'Convert image to base64 string',         icon: '🔤', href: 'tools/image-to-base64/index.html',  accent: '#7c5cfc' },

  // Writing
  { name: 'Word Counter',    desc: 'Words, characters, sentences, paragraphs', icon: '🔢', tag: 'Popular', href: 'tools/word-counter/index.html',   accent: '#5cf8c8' },
  { name: 'Case Converter',  desc: 'UPPER, lower, Title, camel, snake...',     icon: '🔡', href: 'tools/case-converter/index.html',  accent: '#5cf8c8' },
  { name: 'Text Cleaner',    desc: 'Remove duplicates, extra spaces, symbols', icon: '🧹', href: 'tools/text-cleaner/index.html',    accent: '#5cf8c8' },
  { name: 'Slug Generator',  desc: 'Convert text to URL-friendly slugs',       icon: '🔗', href: 'tools/slug-generator/index.html',  accent: '#5cf8c8' },
  { name: 'Lorem Ipsum',     desc: 'Generate placeholder text fast',           icon: '📜', href: 'tools/lorem-ipsum/index.html',     accent: '#5cf8c8' },

  // Business
  { name: 'Invoice Generator',        desc: 'Create & download professional invoices', icon: '🧾', tag: 'Free',    href: 'tools/invoice-generator/index.html',  accent: '#f7b731' },
  { name: 'Password Generator',       desc: 'Generate strong secure passwords',        icon: '🔑', tag: 'Popular', href: 'tools/password-generator/index.html', accent: '#f7b731' },
  { name: 'Password Checker',         desc: 'Test how strong your password is',        icon: '🛡️', href: 'tools/password-checker/index.html',   accent: '#f7b731' },
  { name: 'Privacy Policy Generator', desc: 'Generate a policy for your website',      icon: '📃', href: 'tools/privacy-policy/index.html',     accent: '#f7b731' },

  // Everyday
  { name: 'QR Code Generator', desc: 'Create QR codes for any link or text', icon: '📱', tag: 'Popular', href: 'tools/qr-generator/index.html',   accent: '#45aaf2' },
  { name: 'EMI Calculator',    desc: 'Calculate monthly loan EMI instantly',  icon: '💰', href: 'tools/emi-calculator/index.html',  accent: '#45aaf2' },
  { name: 'Age Calculator',    desc: 'Find exact age from date of birth',     icon: '🎂', href: 'tools/age-calculator/index.html',  accent: '#45aaf2' },
  { name: 'BMI Calculator',    desc: 'Calculate your Body Mass Index',        icon: '⚖️', href: 'tools/bmi-calculator/index.html',  accent: '#45aaf2' },
  { name: 'Unit Converter',    desc: 'Convert length, weight, temperature',   icon: '📏', href: 'tools/unit-converter/index.html',  accent: '#45aaf2' },

  // Developer
  { name: 'Color Picker',    desc: 'Pick colors — get HEX, RGB, HSL',          icon: '🎨', tag: 'Popular', href: 'tools/color-picker/index.html',    accent: '#fd9644' },
  { name: 'JSON Formatter',  desc: 'Format, minify and validate JSON',          icon: '{ }', href: 'tools/json-formatter/index.html', accent: '#fd9644' },
  { name: 'Base64 Encoder',  desc: 'Encode and decode Base64 strings',          icon: '🔤', href: 'tools/base64/index.html',          accent: '#fd9644' },
  { name: 'Regex Tester',    desc: 'Test regular expressions in real-time',     icon: '🔍', href: 'tools/regex-tester/index.html',    accent: '#fd9644' },
];

// ─── SEARCH ─────────────────────────────────────────────────────────────────

const searchInput       = document.getElementById('searchInput');
const searchResults     = document.getElementById('searchResults');
const searchGrid        = document.getElementById('searchGrid');
const categorySections  = document.getElementById('categorySections');

function buildToolCard(tool) {
  const a = document.createElement('a');
  a.className = 'tool-card';
  a.href = tool.href;
  a.style.setProperty('--accent', tool.accent);

  a.innerHTML = `
    <span class="tool-icon">${tool.icon}</span>
    <div class="tool-info">
      <h3>${tool.name}</h3>
      <p>${tool.desc}</p>
    </div>
    ${tool.tag ? `<span class="tool-tag ${tool.tag === 'Popular' ? 'hot' : ''}">${tool.tag}</span>` : ''}
  `;

  return a;
}

function handleSearch() {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    // Show category sections, hide search results
    searchResults.style.display   = 'none';
    categorySections.style.display = 'block';
    return;
  }

  // Filter tools
  const matched = ALL_TOOLS.filter(t =>
    t.name.toLowerCase().includes(query) ||
    t.desc.toLowerCase().includes(query)
  );

  // Hide categories, show search
  categorySections.style.display = 'none';
  searchResults.style.display    = 'block';

  searchGrid.innerHTML = '';

  if (matched.length === 0) {
    searchGrid.innerHTML = '<p class="no-results">No tools found. Try a different keyword.</p>';
    return;
  }

  matched.forEach(tool => {
    searchGrid.appendChild(buildToolCard(tool));
  });
}

// Debounce search for performance
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(handleSearch, 180);
});

// Clear search on ESC
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    handleSearch();
    searchInput.blur();
  }
});