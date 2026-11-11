// ===== Mobile nav toggle =====
const hamburger = document.getElementById('hamburger');
const mainNav = document.getElementById('main-nav');

hamburger.addEventListener('click', () => {
  mainNav.classList.toggle('open');
});

mainNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mainNav.classList.remove('open'));
});

// ===== Stories carousel =====
// Reads track.children fresh each time, so it keeps working after
// loadContent() rebuilds the slides from content.md.
const track = document.getElementById('testimonial-track');
const prevBtn = document.getElementById('t-prev');
const nextBtn = document.getElementById('t-next');
const progress = document.getElementById('t-progress');
let carouselIndex = 0;

function updateCarousel() {
  const slides = Array.from(track.children);
  if (!slides.length) return;
  const style = getComputedStyle(track);
  const gap = parseFloat(style.gap) || 20;
  const offset = slides.slice(0, carouselIndex).reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);
  track.style.transform = `translateX(-${offset}px)`;

  const pct = ((carouselIndex + 1) / slides.length) * 100;
  progress.style.width = `${pct}%`;

  prevBtn.classList.toggle('arrow-btn-active', carouselIndex > 0);
  nextBtn.classList.toggle('arrow-btn-active', carouselIndex < slides.length - 1);
}

function resetCarousel() {
  carouselIndex = 0;
  updateCarousel();
}

prevBtn.addEventListener('click', () => {
  carouselIndex = Math.max(0, carouselIndex - 1);
  updateCarousel();
});

nextBtn.addEventListener('click', () => {
  const slides = Array.from(track.children);
  carouselIndex = Math.min(slides.length - 1, carouselIndex + 1);
  updateCarousel();
});

window.addEventListener('resize', updateCarousel);
updateCarousel();

// ===== Contact form (demo submit — no backend here) =====
const form = document.getElementById('contact-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  const original = submitBtn.textContent;
  submitBtn.textContent = 'Thank you!';
  submitBtn.disabled = true;
  setTimeout(() => {
    submitBtn.textContent = original;
    submitBtn.disabled = false;
    form.reset();
  }, 2200);
});

// ===== content.md — editable site content =====
// Edit content.md (next to this file) and reload the page to see your
// changes. Requires the page to be served over http(s), not opened
// directly as a file:// URL (browsers block fetch() of local files
// under file://). If content.md can't be loaded, the page keeps
// showing the text already written into index.html.
// parseContentMD / escapeHtml / mdInline come from content-parser.js.

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null && value !== '') el.textContent = value;
}

function setHTML(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.innerHTML = value;
}

function setHref(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.href = value;
}

function renderSite(data) {
  const meta = data.meta;
  const s = data.sections;

  document.querySelectorAll('.js-org-name').forEach(el => {
    if (meta.org_name) el.textContent = meta.org_name;
  });
  const navPhone = document.getElementById('nav-phone');
  if (navPhone && meta.nav_phone) {
    navPhone.textContent = meta.nav_phone;
    if (navPhone.tagName === 'A' && meta.nav_phone_href) navPhone.href = 'tel:' + meta.nav_phone_href;
  }
  setText('nav-donate', meta.donate_label);
  setHref('footer-facebook-link', meta.facebook);
  if (meta.email) setHref('footer-email-link', 'mailto:' + meta.email);
  setHref('fab-link', meta.facebook);
  setText('footer-tagline', meta.footer_tagline);
  setText('footer-copyright-text', meta.copyright);
  setHref('footer-website-link', meta.website);
  setText('footer-website-link', meta.website_label);

  if (s.hero) {
    setText('hero-headline', s.hero.meta.headline);
    setText('hero-subheadline', s.hero.meta.subheadline);
    setText('hero-cta', s.hero.meta.cta);
  }

  if (s.about) {
    const container = document.getElementById('about-body');
    if (container && s.about.paragraphs.length) {
      container.innerHTML = '';
      s.about.paragraphs.forEach((p, i) => {
        const el = document.createElement('p');
        el.className = i === 0 ? 'intro-text' : 'intro-lead';
        el.innerHTML = mdInline(p);
        container.appendChild(el);
      });
    }
  }

  if (s.appeal) {
    setText('appeal-eyebrow', s.appeal.meta.eyebrow);
    setText('appeal-heading', s.appeal.meta.heading);
    setText('appeal-subtitle', s.appeal.meta.subtitle);
    setText('appeal-cta', s.appeal.meta.cta);
    if (s.appeal.paragraphs[0]) setHTML('appeal-body', mdInline(s.appeal.paragraphs[0]));

    const statsEl = document.getElementById('appeal-stats');
    if (statsEl && s.appeal.items.length) {
      statsEl.innerHTML = '';
      s.appeal.items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'circle circle-' + ((i % 3) + 1);
        const title = document.createElement('span');
        title.className = 'circle-title';
        title.textContent = item.meta.value || '';
        const sub = document.createElement('span');
        sub.className = 'circle-sub';
        sub.textContent = item.meta.label || '';
        div.append(title, sub);
        statsEl.appendChild(div);
      });
    }
  }

  if (s.programs) {
    setText('programs-heading', s.programs.meta.heading);
    const list = document.getElementById('programs-list');
    if (list && s.programs.items.length) {
      list.innerHTML = '';
      s.programs.items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'container feature-row' + (i % 2 === 1 ? ' reverse' : '');

        const textCol = document.createElement('div');
        textCol.className = 'feature-text';
        const eyebrow = document.createElement('span');
        eyebrow.className = 'eyebrow';
        eyebrow.textContent = item.meta.tag || '';
        const h3 = document.createElement('h3');
        h3.textContent = item.meta.title || item.title;
        const p = document.createElement('p');
        p.innerHTML = mdInline(item.paragraphs[0] || '');
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = meta.facebook || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.append((item.meta.link_label || 'Learn more') + ' ');
        const arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        link.appendChild(arrow);
        textCol.append(eyebrow, h3, p, link);

        const mediaCol = document.createElement('div');
        mediaCol.className = 'feature-media';
        const img = document.createElement('img');
        img.className = 'feature-photo' + (item.meta.portrait === 'true' ? ' feature-photo-portrait' : '');
        img.src = 'images/' + (item.meta.image || '');
        img.alt = item.meta.title || item.title;
        mediaCol.appendChild(img);

        row.append(textCol, mediaCol);
        list.appendChild(row);
      });
    }
  }

  if (s.impact) {
    setText('impact-eyebrow', s.impact.meta.eyebrow);
    setText('impact-heading', s.impact.meta.heading);
    if (s.impact.paragraphs[0]) setHTML('impact-body', mdInline(s.impact.paragraphs[0]));

    const statsEl = document.getElementById('impact-stats');
    if (statsEl && s.impact.items.length) {
      statsEl.innerHTML = '';
      s.impact.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'stat';
        const num = document.createElement('span');
        num.className = 'stat-num';
        num.textContent = item.meta.value || '';
        const label = document.createElement('span');
        label.className = 'stat-label';
        label.textContent = item.meta.label || '';
        div.append(num, label);
        statsEl.appendChild(div);
      });
    }
  }

  if (s.advocacy) {
    setText('advocacy-eyebrow', s.advocacy.meta.eyebrow);
    setText('advocacy-heading', s.advocacy.meta.heading);
    if (s.advocacy.meta.image) {
      const img = document.getElementById('advocacy-image');
      if (img) img.src = 'images/' + s.advocacy.meta.image;
    }
    const list = document.getElementById('advocacy-list');
    if (list && s.advocacy.items.length) {
      list.innerHTML = '';
      s.advocacy.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'advocacy-item';
        const h4 = document.createElement('h4');
        h4.textContent = item.title;
        const p = document.createElement('p');
        p.innerHTML = mdInline(item.paragraphs[0] || '');
        div.append(h4, p);
        list.appendChild(div);
      });
    }
  }

  if (s.stories) {
    setText('stories-heading', s.stories.meta.heading);
    const followBtn = document.getElementById('stories-follow');
    if (followBtn) {
      if (s.stories.meta.follow_label) followBtn.textContent = s.stories.meta.follow_label;
      if (meta.facebook) followBtn.href = meta.facebook;
    }
    if (s.stories.items.length) {
      track.innerHTML = '';
      s.stories.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'testimonial-quote';
        const img = document.createElement('img');
        img.className = 'story-thumb';
        img.src = 'images/' + (item.meta.image || '');
        img.alt = '';
        const date = document.createElement('span');
        date.className = 'story-date';
        date.textContent = item.meta.date || '';
        const p = document.createElement('p');
        p.innerHTML = mdInline(item.paragraphs[0] || '');
        const author = document.createElement('div');
        author.className = 'quote-author';
        author.textContent = item.title;
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = meta.facebook || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.append((item.meta.link_label || 'Read more') + ' ');
        const arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        link.appendChild(arrow);
        card.append(img, date, p, author, link);
        track.appendChild(card);
      });
      resetCarousel();
    }
  }

  if (s.give) {
    setText('give-heading', s.give.meta.heading);
    const g = s.give.meta;
    if (g.bank_name || g.bank_account_name) {
      setHTML('give-bank-detail',
        escapeHtml(g.bank_name || '') + ' — ' + escapeHtml(g.bank_account_name || '') +
        '<br>Peso: ' + escapeHtml(g.peso_account || '') +
        ' · Dollar: ' + escapeHtml(g.dollar_account || '') +
        ' · Swift: ' + escapeHtml(g.swift_code || ''));
    }
    setText('give-gcash', g.gcash_numbers);
    setText('give-dropoff', g.dropoff);
    if (s.give.paragraphs[0]) setHTML('give-note', mdInline(s.give.paragraphs[0]));
  }

  if (s.contact) {
    setText('contact-heading', s.contact.meta.heading);
    if (s.contact.paragraphs[0]) setHTML('contact-intro', mdInline(s.contact.paragraphs[0]));
    setText('office-name', s.contact.meta.office_name);
    setText('office-address', s.contact.meta.address);
    if (s.contact.meta.phone || s.contact.meta.email) {
      setText('office-phone-email', [s.contact.meta.phone, s.contact.meta.email].filter(Boolean).join(' · '));
    }
    setText('contact-checkbox-label', s.contact.meta.checkbox_label);
    setText('contact-submit', s.contact.meta.submit_label);
  }

  applySectionOrder(meta.section_order);
}

// Physically reorders the top-level <section data-section-key="..."> elements
// to match content.md's section_order, so reordering in the editor is
// reflected on the live page (header and footer always stay pinned).
function applySectionOrder(orderStr) {
  if (!orderStr) return;
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  orderStr.split(',').map(s => s.trim()).filter(Boolean).forEach(key => {
    const el = document.querySelector('[data-section-key="' + key + '"]');
    if (el) footer.parentNode.insertBefore(el, footer);
  });
}

fetch('content.md')
  .then(r => { if (!r.ok) throw new Error('content.md not found (' + r.status + ')'); return r.text(); })
  .then(raw => renderSite(parseContentMD(raw)))
  .catch(err => {
    console.warn('[content.md] keeping built-in page text —', err.message);
  });
