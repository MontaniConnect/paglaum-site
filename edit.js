// Content editor — builds a form from content.md (via content-parser.js's
// parseContentMD), lets the client edit it, and on save POSTs the
// re-serialized text to the save-content API, which commits it to GitHub.
//
// This client-side password gate is just UX (hides the form from casual
// visitors). The real check happens server-side in api/save-content.js —
// never trust this gate alone.

let sharedPassword = null;
let contentData = null;

const gate = document.getElementById('gate');
const app = document.getElementById('app');
const gatePassword = document.getElementById('gate-password');
const gateSubmit = document.getElementById('gate-submit');
const gateError = document.getElementById('gate-error');
const loading = document.getElementById('loading');
const form = document.getElementById('content-form');
const statusEl = document.createElement('span');
statusEl.id = 'status';

function unlock() {
  const pw = gatePassword.value.trim();
  if (!pw) {
    gateError.textContent = 'Enter a password first.';
    return;
  }
  sharedPassword = pw;
  gate.style.display = 'none';
  app.style.display = 'block';
  loadContent();
}

gateSubmit.addEventListener('click', unlock);
gatePassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });

function loadContent() {
  fetch('content.md')
    .then(r => { if (!r.ok) throw new Error('content.md not found (' + r.status + ')'); return r.text(); })
    .then(raw => {
      contentData = parseContentMD(raw);
      loading.remove();
      renderForm();
    })
    .catch(err => {
      loading.textContent = 'Could not load content.md: ' + err.message;
    });
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

function renderMetaFields(container, metaObj) {
  Object.keys(metaObj).forEach(key => {
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

function renderItems(container, section, sectionKey, fixedCount) {
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

function renderForm() {
  form.innerHTML = '';

  const siteFieldset = document.createElement('fieldset');
  const siteLegend = document.createElement('legend');
  siteLegend.textContent = 'Site settings';
  siteFieldset.appendChild(siteLegend);
  renderMetaFields(siteFieldset, contentData.meta);
  form.appendChild(siteFieldset);

  Object.entries(contentData.sections).forEach(([key, section]) => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = section.title;
    fieldset.appendChild(legend);

    renderMetaFields(fieldset, section.meta);
    if (section.paragraphs.length || !section.items.length) {
      renderParagraphsField(fieldset, section);
    }
    if (section.items.length) {
      const fixedCount = key === 'appeal' ? 3 : null;
      renderItems(fieldset, section, key, fixedCount);
    }

    form.appendChild(fieldset);
  });

  const saveBar = document.createElement('div');
  saveBar.className = 'save-bar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save changes';
  saveBar.append(statusEl, saveBtn);
  form.appendChild(saveBar);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const saveBtn = form.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  statusEl.className = '';
  statusEl.textContent = 'Saving…';

  const text = serializeContent(contentData);

  fetch(window.EDIT_API_BASE.replace(/\/$/, '') + '/api/save-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: sharedPassword, content: text }),
  })
    .then(async (r) => {
      const result = await r.json().catch(() => ({}));
      if (!r.ok || !result.ok) throw new Error(result.error || ('Save failed (' + r.status + ')'));
      statusEl.className = 'ok';
      statusEl.textContent = 'Saved! The live site will update in about a minute.';
    })
    .catch((err) => {
      statusEl.className = 'err';
      statusEl.textContent = 'Error: ' + err.message;
    })
    .finally(() => {
      saveBtn.disabled = false;
    });
});
