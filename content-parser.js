// Shared content.md parser + serializer.
// Used by script.js (to render the live site) and edit.js (to power the editor).
//
// Format:
//   ---
//   key: value        (frontmatter)
//   ---
//   ## Section Name
//   key: value        (section meta, optional, must come first)
//
//   Body paragraph(s)...
//
//   ### Item Name       (repeatable sub-items, optional)
//   key: value
//
//   Body paragraph(s)...

function parseKeyValueLines(lines) {
  const meta = {};
  const bodyLines = [];
  let inMeta = true;
  let collectedAny = false;
  for (const line of lines) {
    if (inMeta) {
      if (line.trim() === '') {
        if (collectedAny) inMeta = false;
        continue;
      }
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s?(.*)$/);
      if (m) {
        meta[m[1]] = m[2].trim();
        collectedAny = true;
        continue;
      }
      inMeta = false;
    }
    bodyLines.push(line);
  }
  const bodyText = bodyLines.join('\n').trim();
  const paragraphs = bodyText === '' ? [] : bodyText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return { meta, paragraphs };
}

function splitBlocks(text, marker) {
  const lines = text.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith(marker) && !line.startsWith(marker + '#')) {
      if (current) blocks.push(current);
      current = { title: line.slice(marker.length).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseContentMD(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  let frontmatter = {};
  let body = text;
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    frontmatter = parseKeyValueLines(fmMatch[1].split('\n')).meta;
    body = fmMatch[2];
  }

  const sections = {};
  for (const block of splitBlocks(body, '## ')) {
    const key = slugify(block.title);
    const preambleLines = [];
    for (const line of block.lines) {
      if (line.startsWith('### ')) break;
      preambleLines.push(line);
    }
    const { meta, paragraphs } = parseKeyValueLines(preambleLines);
    const items = splitBlocks(block.lines.join('\n'), '### ').map(sb => {
      const parsed = parseKeyValueLines(sb.lines);
      return { title: sb.title, meta: parsed.meta, paragraphs: parsed.paragraphs };
    });
    sections[key] = { title: block.title, meta, paragraphs, items };
  }

  return { meta: frontmatter, sections };
}

const USAGE_NOTE = `<!--
  HOW TO EDIT THIS FILE
  - Edit any value after a "key:" and reload the page (requires the site to be
    served over http, e.g. \`python3 -m http.server\`, not opened as a file:// URL).
  - You can add, remove, or reorder "### " items under Programs, Stories, and
    Advocacy freely — the page rebuilds those lists to match.
  - The 3 "### Stat" items under Appeal are laid out in fixed circle positions —
    keep exactly 3 there, just edit their value/label.
  - "**bold**" inside body paragraphs renders as bold text.
  - image: values are filenames inside the images/ folder.
-->`;

// Reverse of parseContentMD: turns the structured data back into content.md text.
function serializeContent(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data.meta || {})) {
    lines.push(`${k}: ${v}`);
  }
  lines.push('---', '', USAGE_NOTE, '');

  for (const section of Object.values(data.sections || {})) {
    lines.push(`## ${section.title}`, '');
    const metaEntries = Object.entries(section.meta || {});
    for (const [k, v] of metaEntries) lines.push(`${k}: ${v}`);
    if (metaEntries.length) lines.push('');
    for (const p of section.paragraphs || []) {
      lines.push(p, '');
    }
    for (const item of section.items || []) {
      lines.push(`### ${item.title}`, '');
      const itemMetaEntries = Object.entries(item.meta || {});
      for (const [k, v] of itemMetaEntries) lines.push(`${k}: ${v}`);
      if (itemMetaEntries.length) lines.push('');
      for (const p of item.paragraphs || []) {
        lines.push(p, '');
      }
    }
  }

  // collapse any run of 3+ blank lines down to 1, and trim trailing blank lines
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdInline(s) {
  let out = escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a href="mailto:$1">$1</a>');
  return out;
}
