// Section-based content editor — builds a sidebar of content.md's sections,
// shows one section's fields at a time, supports drag-to-reorder, and
// add/rename/delete sections. On save, re-serializes everything (via
// content-parser.js's serializeContent) and commits it straight to GitHub
// using a personal access token the client enters once. No backend: the
// browser talks directly to GitHub's API, and the token is kept only in
// this browser's localStorage, never sent anywhere but api.github.com.

const GITHUB_OWNER = 'MontaniConnect';
const GITHUB_REPO = 'paglaum-site';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'content.md';
const TOKEN_STORAGE_KEY = 'paglaum_gh_token';

const SITE_SETTINGS_KEY = '__site__';

let githubToken = null;
let contentData = null;
let sectionOrder = [];
let activeKey = SITE_SETTINGS_KEY;
let draggedKey = null;

const gate = document.getElementById('gate');
const app = document.getElementById('app');
const gatePassword = document.getElementById('gate-password');
const gateSubmit = document.getElementById('gate-submit');
const gateError = document.getElementById('gate-error');
const loading = document.getElementById('loading');
const form = document.getElementById('content-form');
const nav = document.getElementById('section-nav');
const panel = document.getElementById('section-panel');
const statusEl = document.getElementById('status');
const logoutLink = document.getElementById('logout-link');

function unlock(token) {
  if (!token) {
    gateError.textContent = 'Paste a GitHub token first.';
    return;
  }
  githubToken = token;
  gate.style.display = 'none';
  app.style.display = 'flex';
  loadContent();
}

gateSubmit.addEventListener('click', () => {
  const token = gatePassword.value.trim();
  if (token) {
    try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch { /* storage may be unavailable; still works for this session */ }
  }
  unlock(token);
});
gatePassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') gateSubmit.click(); });

logoutLink.addEventListener('click', (e) => {
  e.preventDefault();
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch { /* ignore */ }
  location.reload();
});

// Auto-unlock if a token is already remembered in this browser.
(function tryAutoUnlock() {
  let remembered = null;
  try { remembered = localStorage.getItem(TOKEN_STORAGE_KEY); } catch { /* ignore */ }
  if (remembered) unlock(remembered);
})();

function loadContent() {
  fetch('content.md')
    .then(r => { if (!r.ok) throw new Error('content.md not found (' + r.status + ')'); return r.text(); })
    .then(raw => {
      contentData = parseContentMD(raw);
      sectionOrder = (contentData.meta.section_order || Object.keys(contentData.sections).join(','))
        .split(',').map(s => s.trim()).filter(Boolean)
        // keep only keys that actually exist, then append any sections the
        // order string might be missing (defensive, shouldn't normally happen)
        .filter(k => contentData.sections[k]);
      Object.keys(contentData.sections).forEach(k => {
        if (!sectionOrder.includes(k)) sectionOrder.push(k);
      });
      activeKey = SITE_SETTINGS_KEY;
      loading.remove();
      form.style.display = 'block';
      renderNav();
      renderPanel();
    })
    .catch(err => {
      loading.textContent = 'Could not load content.md: ' + err.message;
    });
}

// ---------- pure helpers (unit-testable without touching the DOM) ----------

function reorderArray(order, fromKey, toKey) {
  if (fromKey === toKey) return order.slice();
  const next = order.filter(k => k !== fromKey);
  const toIndex = next.indexOf(toKey);
  if (toIndex === -1) return order.slice();
  next.splice(toIndex, 0, fromKey);
  return next;
}

function uniqueSlug(base, existingKeys) {
  let slug = slugify(base) || 'section';
  let candidate = slug;
  let n = 2;
  while (existingKeys.includes(candidate)) {
    candidate = slug + '-' + n;
    n++;
  }
  return candidate;
}

function blankSection(title) {
  return { title, meta: {}, paragraphs: [], items: [] };
}

// ---------- rendering ----------

function renderNav() {
  nav.innerHTML = '';

  const siteItem = document.createElement('div');
  siteItem.className = 'nav-item' + (activeKey === SITE_SETTINGS_KEY ? ' active' : '');
  siteItem.innerHTML = '<span class="nav-label">Site settings</span>';
  siteItem.addEventListener('click', () => { activeKey = SITE_SETTINGS_KEY; renderNav(); renderPanel(); });
  nav.appendChild(siteItem);

  const divider = document.createElement('div');
  divider.className = 'nav-divider';
  nav.appendChild(divider);

  sectionOrder.forEach((key) => {
    const section = contentData.sections[key];
    if (!section) return;
    const item = document.createElement('div');
    item.className = 'nav-item' + (activeKey === key ? ' active' : '');
    item.draggable = true;
    item.dataset.key = key;
    item.innerHTML = '<span class="handle">⠿</span><span class="nav-label"></span>';
    item.querySelector('.nav-label').textContent = section.title;

    item.addEventListener('click', () => { activeKey = key; renderNav(); renderPanel(); });

    item.addEventListener('dragstart', (e) => {
      draggedKey = key;
      item.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      nav.querySelectorAll('.nav-item').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (draggedKey && draggedKey !== key) {
        sectionOrder = reorderArray(sectionOrder, draggedKey, key);
        renderNav();
      }
      draggedKey = null;
    });

    nav.appendChild(item);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-section-btn';
  addBtn.textContent = '+ Add Section';
  addBtn.addEventListener('click', () => {
    const name = prompt('Name for the new section:');
    if (!name || !name.trim()) return;
    const key = uniqueSlug(name.trim(), [SITE_SETTINGS_KEY, ...sectionOrder]);
    contentData.sections[key] = blankSection(name.trim());
    sectionOrder.push(key);
    activeKey = key;
    renderNav();
    renderPanel();
  });
  nav.appendChild(addBtn);
}

function makeField(labelText, value, onChange, multiline) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = document.createElement(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = 'text';
  input.value = value || '';
  input.addEventListener('input', () => onChange(input.value));
  wrap.append(label, input);
  return wrap;
}

function prettyLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderMetaFields(container, metaObj, excludeKeys) {
  Object.keys(metaObj).forEach(key => {
    if (excludeKeys && excludeKeys.includes(key)) return;
    container.appendChild(makeField(prettyLabel(key), metaObj[key], (v) => { metaObj[key] = v; }));
  });
}

function renderParagraphsField(container, section) {
  container.appendChild(makeField('Body text', section.paragraphs.join('\n\n'), (v) => {
    section.paragraphs = v.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }, true));
}

function blankItemLike(items) {
  const template = items[0];
  const meta = {};
  if (template) Object.keys(template.meta).forEach(k => { meta[k] = ''; });
  return { title: 'New item', meta, paragraphs: [] };
}

function renderItems(container, section, fixedCount) {
  const itemsWrap = document.createElement('div');
  container.appendChild(itemsWrap);

  function draw() {
    itemsWrap.innerHTML = '';
    section.items.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const head = document.createElement('div');
      head.className = 'item-head';
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = item.title;
      titleInput.style.flex = '1';
      titleInput.addEventListener('input', () => { item.title = titleInput.value; });
      head.appendChild(titleInput);

      if (!fixedCount) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          section.items.splice(i, 1);
          draw();
        });
        head.appendChild(removeBtn);
      }
      card.appendChild(head);

      renderMetaFields(card, item.meta);
      renderParagraphsField(card, item);
      itemsWrap.appendChild(card);
    });
  }
  draw();

  if (!fixedCount) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-add';
    addBtn.textContent = '+ Add item';
    addBtn.addEventListener('click', () => {
      section.items.push(blankItemLike(section.items));
      draw();
    });
    container.appendChild(addBtn);
  }
}

function renderPanel() {
  panel.innerHTML = '';

  if (activeKey === SITE_SETTINGS_KEY) {
    const header = document.createElement('div');
    header.className = 'panel-header';
    const title = document.createElement('h2');
    title.textContent = 'Site settings';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    header.appendChild(title);
    panel.appendChild(header);
    renderMetaFields(panel, contentData.meta, ['section_order']);
    return;
  }

  const section = contentData.sections[activeKey];
  if (!section) return;

  const header = document.createElement('div');
  header.className = 'panel-header';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'panel-title-input';
  titleInput.value = section.title;
  titleInput.addEventListener('input', () => {
    section.title = titleInput.value;
    const navLabel = nav.querySelector('.nav-item[data-key="' + activeKey + '"] .nav-label');
    if (navLabel) navLabel.textContent = section.title;
  });
  header.appendChild(titleInput);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-delete-section';
  deleteBtn.textContent = 'Delete section';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('Delete the "' + section.title + '" section? This cannot be undone until you save.')) return;
    delete contentData.sections[activeKey];
    sectionOrder = sectionOrder.filter(k => k !== activeKey);
    activeKey = sectionOrder[0] || SITE_SETTINGS_KEY;
    renderNav();
    renderPanel();
  });
  header.appendChild(deleteBtn);

  panel.appendChild(header);

  renderMetaFields(panel, section.meta);
  if (section.paragraphs.length || !section.items.length) {
    renderParagraphsField(panel, section);
  }
  if (section.items.length) {
    const fixedCount = activeKey === 'appeal' ? 3 : null;
    renderItems(panel, section, fixedCount);
  }
}

// UTF-8-safe base64 encoding (plain btoa mangles non-ASCII characters like — or ₱).
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function saveToGitHub(content, token) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

  let sha;
  const getResp = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers });
  if (getResp.ok) {
    sha = (await getResp.json()).sha;
  } else if (getResp.status !== 404) {
    const err = await getResp.json().catch(() => ({}));
    throw new Error(err.message || `GitHub lookup failed (${getResp.status})`);
  }

  const putResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update site content via editor',
      content: utf8ToBase64(content),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!putResp.ok) {
    const err = await putResp.json().catch(() => ({}));
    throw new Error(err.message || `GitHub commit failed (${putResp.status})`);
  }
  const result = await putResp.json();
  return result.commit && result.commit.html_url;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const saveBtn = form.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  statusEl.className = '';
  statusEl.textContent = 'Saving…';

  const text = serializeContent(contentData, sectionOrder);

  saveToGitHub(text, githubToken)
    .then(() => {
      statusEl.className = 'ok';
      statusEl.textContent = 'Saved! The live site will update in about a minute.';
    })
    .catch((err) => {
      statusEl.className = 'err';
      statusEl.textContent = 'Error: ' + err.message +
        (/bad credentials/i.test(err.message) ? ' — your token may be wrong or expired. Click "Log out" and paste a new one.' : '');
    })
    .finally(() => {
      saveBtn.disabled = false;
    });
});
