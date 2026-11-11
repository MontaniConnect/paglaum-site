// Vercel serverless function.
// Receives the edited content.md text from edit.html, checks the shared
// password, and commits the new file straight to the GitHub repo via the
// GitHub Contents API. GitHub Pages then rebuilds the live site from that
// commit automatically.
//
// Required environment variables (set these in the Vercel project
// dashboard, never commit them):
//   EDIT_PASSWORD   - the shared password the edit page checks against
//   GITHUB_TOKEN    - a fine-grained PAT scoped to this repo, contents: write
//   GITHUB_OWNER    - repo owner/org, e.g. "MontaniConnect"
//   GITHUB_REPO     - repo name, e.g. "paglaum-site"
// Optional:
//   GITHUB_BRANCH     - defaults to "main"
//   GITHUB_FILE_PATH  - defaults to "content.md"

const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { EDIT_PASSWORD, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
  const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'content.md';

  if (!EDIT_PASSWORD || !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    res.status(500).json({ ok: false, error: 'Server is not configured yet (missing environment variables).' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { password, content, verifyOnly } = body || {};

  if (!password || !timingSafeEqual(password, EDIT_PASSWORD)) {
    res.status(401).json({ ok: false, error: 'Wrong password.' });
    return;
  }

  // The editor's gate calls this with verifyOnly to check the password
  // immediately, before touching GitHub at all.
  if (verifyOnly) {
    res.status(200).json({ ok: true });
    return;
  }

  if (typeof content !== 'string' || !content.trim().startsWith('---')) {
    res.status(400).json({ ok: false, error: 'Content looks malformed (expected it to start with the --- frontmatter).' });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_FILE_PATH)}`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'paglaum-content-editor',
    Accept: 'application/vnd.github+json',
  };

  try {
    // 1. Look up the file's current sha (required to update an existing file).
    let sha;
    const getResp = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers: ghHeaders });
    if (getResp.ok) {
      const current = await getResp.json();
      sha = current.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      res.status(502).json({ ok: false, error: `GitHub lookup failed: ${getResp.status} ${errText}` });
      return;
    }

    // 2. Commit the new content.
    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update site content via editor',
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      res.status(502).json({ ok: false, error: `GitHub commit failed: ${putResp.status} ${errText}` });
      return;
    }

    const result = await putResp.json();
    res.status(200).json({ ok: true, commitUrl: result.commit && result.commit.html_url });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
};
