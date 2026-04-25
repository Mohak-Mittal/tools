const searchInput = document.getElementById('searchInput');
const cards = document.querySelectorAll('.tool-card');
const noResults = document.getElementById('noResults');
const noResultsQuery = document.getElementById('noResultsQuery');
const categorySections = document.querySelectorAll('.category-section');
const catBtns = document.querySelectorAll('.cat-btn');

// ── SEARCH ──
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  let visible = 0;

  cards.forEach(card => {
    const name = card.getAttribute('data-name');
    const match = !q || name.includes(q);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });

  // Show/hide category sections based on visible cards
  categorySections.forEach(section => {
    const hasVisible = [...section.querySelectorAll('.tool-card:not(.hidden)')].length > 0;
    section.style.display = hasVisible ? 'block' : 'none';
  });

  if (visible === 0) {
    noResults.style.display = 'block';
    noResultsQuery.textContent = searchInput.value;
  } else {
    noResults.style.display = 'none';
  }

  // Reset category filter when searching
  if (q) {
    catBtns.forEach(b => b.classList.remove('active'));
    catBtns[0].classList.add('active');
  }
});

// ── CATEGORY FILTER ──
catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const cat = btn.getAttribute('data-cat');
    searchInput.value = '';

    cards.forEach(card => {
      const cardCat = card.getAttribute('data-cat');
      const show = cat === 'all' || cardCat === cat;
      card.classList.toggle('hidden', !show);
    });

    categorySections.forEach(section => {
      const id = section.id.replace('cat-', '');
      section.style.display = (cat === 'all' || cat === id) ? 'block' : 'none';
    });

    noResults.style.display = 'none';
  });
});

// ── KEYBOARD SHORTCUT (Cmd/Ctrl + K) ──
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
});