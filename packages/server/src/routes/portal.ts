// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAdminAuth } from '../providers/auth/types.js';

function applyPortalCsp(reply: FastifyReply): void {
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...rest] = c.trim().split('=');
      return [k?.trim() ?? '', decodeURIComponent(rest.join('='))];
    }),
  );
}

/**
 * Lightweight built-in web portal for interacting with registry and org APIs.
 * Features:
 * - Public registry exploration (search across local + upstreams)
 * - Authenticated org dashboard (manage tools, members, view details)
 * - Admin publishing interface
 * - Admin portal for org setup (requires admin token)
 */
export async function registerPortalRoutes(
  fastify: FastifyInstance,
  adminAuth?: IAdminAuth,
): Promise<void> {
  // Parse URL-encoded form bodies (used by the admin login form)
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const result: Record<string, string> = {};
        for (const pair of String(body).split('&')) {
          const [k, ...rest] = pair.split('=');
          if (k) result[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
        }
        done(null, result);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
  fastify.get('/', async (_req, reply) => {
    applyPortalCsp(reply);
    return reply.type('text/html; charset=utf-8').send(PORTAL_HTML);
  });

  fastify.get<{ Params: { name: string } }>('/skills/:name', async (req, reply) => {
    applyPortalCsp(reply);
    return reply
      .type('text/html; charset=utf-8')
      .send(renderSkillDetailHtml(req.params.name));
  });

  // Admin portal (optional, only if admin auth is configured)
  if (adminAuth) {
    fastify.get('/admin/login', async (_req, reply) => {
      applyPortalCsp(reply);
      return reply.type('text/html; charset=utf-8').send(ADMIN_LOGIN_HTML);
    });

    fastify.post<{ Body: { token?: string } }>(
      '/admin/login',
      async (req, reply) => {
        const submitted = req.body?.token ?? '';
        const sessionId = adminAuth.createSession
          ? await adminAuth.createSession(submitted)
          : null;
        if (sessionId) {
          return reply
            .header(
              'Set-Cookie',
              `admin_session=${sessionId}; Path=/admin; HttpOnly; SameSite=Strict`,
            )
            .redirect('/admin');
        }
        applyPortalCsp(reply);
        return reply
          .type('text/html; charset=utf-8')
          .send(ADMIN_LOGIN_HTML.replace('<!--ERROR-->', '<p class="login-error">Invalid token. Please try again.</p>'));
      },
    );

    fastify.get('/admin/logout', async (req, reply) => {
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies['admin_session'];
      if (sessionId && adminAuth.invalidateSession) {
        await adminAuth.invalidateSession(sessionId);
      }
      return reply
        .header('Set-Cookie', 'admin_session=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0')
        .redirect('/admin/login');
    });

    fastify.get('/admin', async (req, reply) => {
      const cookies = parseCookies(req.headers.cookie);
      const ok = await adminAuth.check({ headers: req.headers, cookies });
      if (!ok) return reply.redirect('/admin/login');
      applyPortalCsp(reply);
      return reply.type('text/html; charset=utf-8').send(ADMIN_PORTAL_HTML);
    });
  }
}

function renderSkillDetailHtml(toolName: string): string {
  const encodedName = encodeURIComponent(toolName);
  const escapedName = escapeHtml(toolName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Skill Details - ${escapedName}</title>
    <meta name="description" content="View details for ${escapedName} — an ai-tools registry skill." />
    <style>
      :root {
        --bg: #f2efe7;
        --bg-2: #dbe7c9;
        --ink: #102a43;
        --accent: #ef5b5b;
        --accent-2: #2a9d8f;
        --panel: rgba(255, 255, 255, 0.9);
        --shadow: 0 20px 40px rgba(16, 42, 67, 0.18);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 12% 20%, rgba(239, 91, 91, 0.2), transparent 40%),
          radial-gradient(circle at 85% 85%, rgba(42, 157, 143, 0.2), transparent 42%),
          linear-gradient(145deg, var(--bg), var(--bg-2));
      }
      .container {
        max-width: 980px;
        margin: 28px auto;
        padding: 0 16px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid rgba(16, 42, 67, 0.15);
        border-radius: 14px;
        box-shadow: var(--shadow);
        padding: 16px;
        margin-bottom: 12px;
      }
      h1 { margin: 0; font-size: 1.8rem; }
      .subtitle { margin: 6px 0 0; opacity: 0.8; }
      .meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
      .chip {
        display: inline-block;
        background: rgba(42, 157, 143, 0.12);
        color: var(--accent-2);
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
      }
      .kv { margin: 6px 0; font-size: 0.9rem; }
      .kv b { font-weight: 600; }
      .list { margin: 0; padding-left: 18px; }
      pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 0.82rem;
        background: rgba(16, 42, 67, 0.95);
        color: #f1f5f9;
        border-radius: 10px;
        padding: 12px;
        max-height: 360px;
        overflow: auto;
      }
      a.btn {
        display: inline-block;
        color: white;
        background: linear-gradient(120deg, var(--accent), #f26d6d);
        border-radius: 10px;
        padding: 8px 12px;
        text-decoration: none;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="panel">
        <a href="/" class="btn">Back to Portal</a>
        <h1 id="name">${escapedName}</h1>
        <p id="desc" class="subtitle">Loading details...</p>
        <div id="meta" class="meta"></div>
      </div>

      <div class="grid">
        <section class="panel">
          <h2>Ownership</h2>
          <div id="owner" class="kv">Loading...</div>
        </section>

        <section class="panel">
          <h2>Versions</h2>
          <ul id="versions" class="list"></ul>
        </section>
      </div>

      <section class="panel">
        <h2>Manifest (latest)</h2>
        <pre id="manifest">Loading...</pre>
      </section>
    </div>

    <script>
      const toolName = decodeURIComponent('${encodedName}');

      async function fetchJson(path) {
        const res = await fetch(path);
        const text = await res.text();
        try {
          return { ok: res.ok, status: res.status, body: JSON.parse(text) };
        } catch {
          return { ok: res.ok, status: res.status, body: text };
        }
      }

      function addChip(text) {
        const el = document.createElement('span');
        el.className = 'chip';
        el.textContent = text;
        return el;
      }

      async function load() {
        const manifestRes = await fetchJson('/api/tools/' + encodeURIComponent(toolName));
        const versionsRes = await fetchJson('/api/tools/' + encodeURIComponent(toolName) + '/versions');
        const ownerRes = await fetchJson('/api/tools/' + encodeURIComponent(toolName) + '/owner');

        if (!manifestRes.ok) {
          document.getElementById('desc').textContent = 'Tool not found.';
          document.getElementById('manifest').textContent = JSON.stringify(manifestRes.body, null, 2);
          return;
        }

        const manifest = manifestRes.body;
        document.getElementById('name').textContent = manifest.name;
        document.getElementById('desc').textContent = manifest.description || 'No description';
        document.getElementById('manifest').textContent = JSON.stringify(manifest, null, 2);

        const metaEl = document.getElementById('meta');
        metaEl.innerHTML = '';
        metaEl.appendChild(addChip('latest: ' + (manifest.version || 'unknown')));
        if (manifest.category) metaEl.appendChild(addChip(manifest.category));
        (manifest.keywords || []).slice(0, 6).forEach((k) => metaEl.appendChild(addChip(k)));

        const versionsEl = document.getElementById('versions');
        versionsEl.innerHTML = '';
        if (versionsRes.ok && Array.isArray(versionsRes.body.versions)) {
          for (const version of versionsRes.body.versions) {
            const li = document.createElement('li');
            li.textContent = String(version);
            versionsEl.appendChild(li);
          }
        } else {
          const li = document.createElement('li');
          li.textContent = 'No version history available';
          versionsEl.appendChild(li);
        }

        const ownerEl = document.getElementById('owner');
        if (ownerRes.ok && ownerRes.body.owner) {
          ownerEl.innerHTML =
            '<div class="kv"><b>Org:</b> ' + ownerRes.body.owner.org + '</div>' +
            '<div class="kv"><b>Created By:</b> ' + ownerRes.body.owner.createdBy + '</div>' +
            '<div class="kv"><b>Created At:</b> ' + ownerRes.body.owner.createdAt + '</div>';
        } else {
          ownerEl.textContent = 'No ownership metadata available';
        }
      }

      load().catch((err) => {
        document.getElementById('desc').textContent = 'Failed to load details';
        document.getElementById('manifest').textContent = String(err);
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ADMIN_LOGIN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Login — ai-tools</title>
    <style>
      :root {
        --bg: #f2efe7;
        --bg-2: #dbe7c9;
        --ink: #102a43;
        --accent: #ef5b5b;
        --accent-2: #2a9d8f;
        --panel: rgba(255, 255, 255, 0.92);
        --shadow: 0 24px 60px rgba(16, 42, 67, 0.22);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 20%, rgba(239, 91, 91, 0.22), transparent 42%),
          radial-gradient(circle at 85% 85%, rgba(42, 157, 143, 0.22), transparent 44%),
          linear-gradient(145deg, var(--bg), var(--bg-2));
      }
      .card {
        background: var(--panel);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(16, 42, 67, 0.14);
        border-radius: 20px;
        box-shadow: var(--shadow);
        padding: 40px 36px 32px;
        width: 100%;
        max-width: 380px;
      }
      .logo {
        font-size: 2.2rem;
        text-align: center;
        margin-bottom: 6px;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 1.5rem;
        text-align: center;
        letter-spacing: 0.01em;
      }
      .tagline {
        text-align: center;
        opacity: 0.65;
        font-size: 0.88rem;
        margin: 0 0 28px;
      }
      label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        margin-bottom: 6px;
        opacity: 0.8;
      }
      input[type="password"] {
        width: 100%;
        border: 1.5px solid rgba(16, 42, 67, 0.2);
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        font-size: 0.95rem;
        background: rgba(255, 255, 255, 0.95);
        outline: none;
        transition: border-color .15s ease;
      }
      input[type="password"]:focus {
        border-color: var(--accent-2);
      }
      button[type="submit"] {
        margin-top: 18px;
        width: 100%;
        border: 0;
        border-radius: 12px;
        padding: 13px;
        font: inherit;
        font-weight: 700;
        font-size: 1rem;
        color: #fff;
        background: linear-gradient(120deg, var(--accent), #f26d6d);
        cursor: pointer;
        transition: filter .15s ease, transform .12s ease;
      }
      button[type="submit"]:hover {
        filter: brightness(1.06);
        transform: translateY(-1px);
      }
      .login-error {
        margin: 14px 0 0;
        padding: 10px 14px;
        background: rgba(239, 91, 91, 0.12);
        color: var(--accent);
        border: 1px solid var(--accent);
        border-radius: 10px;
        font-size: 0.85rem;
        text-align: center;
      }
      .back {
        display: block;
        text-align: center;
        margin-top: 18px;
        font-size: 0.85rem;
        color: var(--accent-2);
        text-decoration: none;
        opacity: 0.8;
      }
      .back:hover { opacity: 1; text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">🔐</div>
      <h1>Admin Login</h1>
      <p class="tagline">ai-tools registry administration</p>

      <form method="POST" action="/admin/login" autocomplete="off">
        <label for="token">Admin Token</label>
        <input
          id="token"
          name="token"
          type="password"
          placeholder="Enter your admin token"
          autofocus
          required
        />
        <!--ERROR-->
        <button type="submit">Sign in</button>
      </form>

      <a href="/" class="back">← Back to Portal</a>
    </div>
  </body>
</html>`;

const ADMIN_PORTAL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ai-tools Admin Portal</title>
    <style>
      :root {
        --bg: #f2efe7;
        --bg-2: #dbe7c9;
        --ink: #102a43;
        --accent: #ef5b5b;
        --accent-2: #2a9d8f;
        --panel: rgba(255, 255, 255, 0.86);
        --shadow: 0 24px 60px rgba(16, 42, 67, 0.2);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 12% 20%, rgba(239, 91, 91, 0.2), transparent 40%),
          radial-gradient(circle at 85% 85%, rgba(42, 157, 143, 0.2), transparent 42%),
          linear-gradient(145deg, var(--bg), var(--bg-2));
      }
      .container {
        max-width: 1040px;
        margin: 28px auto;
        padding: 0 16px;
      }
      .hero {
        padding: 18px 0 14px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(1.8rem, 3.2vw, 2.7rem);
        letter-spacing: 0.01em;
      }
      .subtitle {
        margin: 0;
        opacity: 0.82;
      }
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      }
      .panel {
        background: var(--panel);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(16, 42, 67, 0.15);
        border-radius: 16px;
        box-shadow: var(--shadow);
        padding: 14px;
      }
      .panel h2 {
        margin: 0 0 12px;
        font-size: 1.02rem;
      }
      .panel h3 {
        margin: 14px 0 8px;
        font-size: 0.95rem;
      }
      label {
        display: block;
        font-size: 0.82rem;
        margin-bottom: 4px;
      }
      input, textarea, select {
        width: 100%;
        border: 1px solid rgba(16, 42, 67, 0.22);
        border-radius: 10px;
        padding: 10px;
        font: inherit;
        background: rgba(255, 255, 255, 0.93);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 9px 12px;
        font: inherit;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(120deg, var(--accent), #f26d6d);
        cursor: pointer;
        transform: translateY(0);
        transition: transform .12s ease, filter .15s ease;
      }
      button.alt {
        background: linear-gradient(120deg, var(--accent-2), #49b6ab);
      }
      button:hover { transform: translateY(-1px); filter: brightness(1.03); }
      .output {
        margin-top: 12px;
        white-space: pre-wrap;
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 0.84rem;
        background: rgba(16, 42, 67, 0.95);
        color: #f1f5f9;
        border-radius: 10px;
        padding: 12px;
        min-height: 120px;
        max-height: 300px;
        overflow-y: auto;
      }
      .results-list {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
      }
      .result-item {
        background: var(--panel);
        border: 1px solid rgba(16, 42, 67, 0.15);
        border-radius: 12px;
        padding: 12px 14px;
        transition: all .15s ease;
      }
      .result-item:hover {
        border-color: var(--accent-2);
        box-shadow: 0 4px 12px rgba(42, 157, 143, 0.15);
      }
      .result-title {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--ink);
        margin: 0 0 4px;
      }
      .result-meta {
        display: flex;
        gap: 12px;
        font-size: 0.8rem;
        opacity: 0.7;
        flex-wrap: wrap;
      }
      .result-tag {
        display: inline-block;
        background: rgba(42, 157, 143, 0.1);
        color: var(--accent-2);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
      }
      .empty-state {
        text-align: center;
        padding: 16px;
        color: rgba(16, 42, 67, 0.6);
        font-style: italic;
      }
      .alert {
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 10px;
        font-size: 0.85rem;
      }
      .alert.success {
        background: rgba(42, 157, 143, 0.15);
        color: var(--accent-2);
        border: 1px solid var(--accent-2);
      }
      .alert.error {
        background: rgba(239, 91, 91, 0.15);
        color: var(--accent);
        border: 1px solid var(--accent);
      }
      .back-link {
        text-decoration: none;
        color: var(--accent-2);
        font-size: 0.9rem;
        display: inline-block;
        margin-bottom: 12px;
      }
      .back-link:hover {
        text-decoration: underline;
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
      }
      .logout-btn {
        border: 1.5px solid var(--accent);
        border-radius: 10px;
        padding: 7px 14px;
        font: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent);
        background: transparent;
        cursor: pointer;
        text-decoration: none;
        transition: background .15s ease, color .15s ease;
      }
      .logout-btn:hover {
        background: var(--accent);
        color: #fff;
      }
      @media (max-width: 740px) {
        .row { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header-row">
        <a href="/" class="back-link">← Back to Portal</a>
        <a href="/admin/logout" class="logout-btn">Sign out</a>
      </div>

      <div class="hero">
        <h1>🔐 Admin Panel</h1>
        <p class="subtitle">Initialize organizations and manage setup.</p>
      </div>

      <div class="grid">
        <!-- Create Org -->
        <section class="panel">
          <h2>Create Organization</h2>
          <div>
            <label for="orgName">Org Name</label>
            <input id="orgName" placeholder="acme" />
          </div>
          <div style="margin-top: 10px;">
            <label for="orgMetadata">Metadata (JSON, optional)</label>
            <textarea id="orgMetadata" placeholder="{}" style="min-height: 60px;"></textarea>
          </div>
          <div class="actions" style="margin-top: 10px;">
            <button id="createOrg">Create Org</button>
          </div>
        </section>

        <!-- List Orgs -->
        <section class="panel">
          <h2>Organizations</h2>
          <div class="actions" style="margin-bottom: 10px;">
            <button id="listOrgs" class="alt">Refresh Org List</button>
          </div>
          <div id="orgsList" class="results-list">
            <div class="empty-state">Click "Refresh Org List" to load orgs</div>
          </div>
        </section>

        <!-- Add Member -->
        <section class="panel">
          <h2>Add Org Member</h2>
          <div class="row">
            <div>
              <label for="memberOrgName">Org Name</label>
              <input id="memberOrgName" placeholder="acme" />
            </div>
            <div>
              <label for="userId">User ID</label>
              <input id="userId" placeholder="alice" />
            </div>
          </div>
          <div class="actions" style="margin-top: 10px;">
            <button id="addMember">Add Member</button>
          </div>
        </section>

        <!-- Generate Token -->
        <section class="panel">
          <h2>Generate User Token</h2>
          <div class="row">
            <div>
              <label for="tokenOrgName">Org Name</label>
              <input id="tokenOrgName" placeholder="acme" />
            </div>
            <div>
              <label for="tokenUserId">User ID</label>
              <input id="tokenUserId" placeholder="alice" />
            </div>
          </div>
          <div class="actions" style="margin-top: 10px;">
            <button id="generateToken">Generate Token</button>
          </div>
        </section>

        <!-- Delete Org -->
        <section class="panel">
          <h2>Delete Organization</h2>
          <p class="tiny" style="margin: 0 0 10px; opacity: 0.8;">⚠️ This action cannot be undone.</p>
          <div>
            <label for="deleteOrgName">Org Name</label>
            <input id="deleteOrgName" placeholder="acme" />
          </div>
          <div class="actions" style="margin-top: 10px;">
            <button id="deleteOrg" style="background: #d17a7a;">Delete Org</button>
          </div>
        </section>

        <!-- Audit Log -->
        <section class="panel" style="grid-column: 1 / -1;">
          <h2>Audit Log</h2>
          <div class="actions" style="margin-bottom: 10px;">
            <button id="viewAuditLog" class="alt">View Audit Log</button>
          </div>
          <div id="auditLogList" class="results-list">
            <div class="empty-state">Click "View Audit Log" to load entries</div>
          </div>
        </section>
      </div>

      <div id="output" class="output" aria-live="polite" style="margin-top: 20px;">Ready.</div>
    </div>

    <script>
      const outputEl = document.getElementById('output');
      const orgNameEl = document.getElementById('orgName');
      const orgMetadataEl = document.getElementById('orgMetadata');
      const memberOrgNameEl = document.getElementById('memberOrgName');
      const userIdEl = document.getElementById('userId');
      const tokenOrgNameEl = document.getElementById('tokenOrgName');
      const tokenUserIdEl = document.getElementById('tokenUserId');
      const deleteOrgNameEl = document.getElementById('deleteOrgName');
      const orgListEl = document.getElementById('orgsList');
      const auditLogListEl = document.getElementById('auditLogList');

      function log(title, payload) {
        const rendered = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
        outputEl.textContent = '[' + new Date().toLocaleTimeString() + '] ' + title + '\\n' + rendered;
      }

      function showAlert(message, type = 'success') {
        const div = document.createElement('div');
        div.className = 'alert ' + type;
        div.textContent = message;
        outputEl.parentElement.insertBefore(div, outputEl);
        setTimeout(() => div.remove(), 5000);
      }

      async function apiAdmin(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const res = await fetch(path, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/admin/login';
          return { status: res.status, body: {} };
        }
        const text = await res.text();
        try {
          return { status: res.status, body: JSON.parse(text) };
        } catch {
          return { status: res.status, body: text };
        }
      }

      document.getElementById('createOrg').addEventListener('click', async () => {
        const name = orgNameEl.value.trim();
        if (!name) {
          showAlert('Org name is required', 'error');
          return;
        }

        let metadata;
        try {
          metadata = orgMetadataEl.value.trim() ? JSON.parse(orgMetadataEl.value) : undefined;
        } catch {
          showAlert('Invalid metadata JSON', 'error');
          return;
        }

        const result = await apiAdmin('/api/admin/orgs', {
          method: 'POST',
          body: JSON.stringify({ name, metadata }),
        });

        if (result.status === 201) {
          showAlert('Org created: ' + name, 'success');
          orgNameEl.value = '';
          orgMetadataEl.value = '';
          log('Org Created', result.body);
        } else {
          showAlert('Failed to create org: ' + (result.body.error || 'Unknown error'), 'error');
          log('Create Org Error', result.body);
        }
      });

      document.getElementById('listOrgs').addEventListener('click', async () => {
        const result = await apiAdmin('/api/admin/orgs');
        if (result.status === 200 && result.body.orgs) {
          const orgs = result.body.orgs;
          if (orgs.length === 0) {
            orgListEl.innerHTML = '<div class="empty-state">No organizations created yet</div>';
          } else {
            orgListEl.innerHTML = orgs.map(o => \`
              <div class="result-item">
                <div class="result-title">\${o.name}</div>
                <div class="result-meta">
                  <span>\${o.members.length} member(s)</span>
                  <span class="result-tag">Created: \${new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
                <div style="margin-top: 8px; font-size: 0.82rem; color: #555;">
                  Members: \${o.members.join(', ') || '(none)'}
                </div>
              </div>
            \`).join('');
          }
          log('Orgs Listed', { count: orgs.length, orgs });
        } else {
          orgListEl.innerHTML = '<div class="empty-state">Error loading orgs</div>';
          log('List Orgs Error', result.body);
        }
      });

      document.getElementById('addMember').addEventListener('click', async () => {
        const orgName = memberOrgNameEl.value.trim();
        const userId = userIdEl.value.trim();

        if (!orgName || !userId) {
          showAlert('Org name and user ID are required', 'error');
          return;
        }

        const result = await apiAdmin('/api/admin/orgs/' + encodeURIComponent(orgName) + '/members', {
          method: 'POST',
          body: JSON.stringify({ userId }),
        });

        if (result.status === 200) {
          showAlert(userId + ' added to ' + orgName, 'success');
          memberOrgNameEl.value = '';
          userIdEl.value = '';
          log('Member Added', result.body);
        } else {
          showAlert('Failed to add member: ' + (result.body.error || 'Unknown error'), 'error');
          log('Add Member Error', result.body);
        }
      });

      document.getElementById('generateToken').addEventListener('click', async () => {
        const org = tokenOrgNameEl.value.trim();
        const userId = tokenUserIdEl.value.trim();

        if (!org || !userId) {
          showAlert('Org name and user ID are required', 'error');
          return;
        }

        const result = await apiAdmin('/api/admin/tokens', {
          method: 'POST',
          body: JSON.stringify({ org, userId }),
        });

        if (result.status === 200) {
          showAlert('Token generated for ' + userId, 'success');
          log('Token Generated', result.body);
          tokenOrgNameEl.value = '';
          tokenUserIdEl.value = '';
        } else {
          showAlert('Failed to generate token: ' + (result.body.error || 'Unknown error'), 'error');
          log('Generate Token Error', result.body);
        }
      });

      document.getElementById('deleteOrg').addEventListener('click', async () => {
        const name = deleteOrgNameEl.value.trim();
        if (!name) {
          showAlert('Org name is required', 'error');
          return;
        }

        if (!confirm('Are you sure you want to delete org "' + name + '"? This cannot be undone.')) {
          return;
        }

        const result = await apiAdmin('/api/admin/orgs/' + encodeURIComponent(name), {
          method: 'DELETE',
        });

        if (result.status === 200) {
          showAlert('Org deleted: ' + name, 'success');
          deleteOrgNameEl.value = '';
          log('Org Deleted', result.body);
        } else {
          showAlert('Failed to delete org: ' + (result.body.error || 'Unknown error'), 'error');
          log('Delete Org Error', result.body);
        }
      });

      document.getElementById('viewAuditLog').addEventListener('click', async () => {
        const result = await apiAdmin('/api/admin/audit-log');
        if (result.status === 200 && result.body.entries) {
          const entries = result.body.entries;
          if (entries.length === 0) {
            auditLogListEl.innerHTML = '<div class="empty-state">No audit entries yet</div>';
          } else {
            auditLogListEl.innerHTML = entries.slice().reverse().map(e => \`
              <div class="result-item">
                <div class="result-title">\${e.action}</div>
                <div class="result-meta">
                  <span>\${new Date(e.timestamp).toLocaleString()}</span>
                  <span class="result-tag">By: \${e.actor}</span>
                  \${e.orgName ? '<span>' + e.orgName + '</span>' : ''}
                  \${e.userId ? '<span>' + e.userId + '</span>' : ''}
                </div>
              </div>
            \`).join('');
          }
          log('Audit Log Loaded', { count: entries.length });
        } else {
          auditLogListEl.innerHTML = '<div class="empty-state">Error loading audit log</div>';
          log('Audit Log Error', result.body);
        }
      });

      // Auto-load orgs on page load
      document.getElementById('listOrgs').click();
    </script>
  </body>
</html>`;

const PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ai-tools Registry</title>
  <meta name="description" content="ai-tools registry — browse, search, and publish AI tools and skills for your AI development workflow." />
  <style>
    :root {
      --bg: #f2efe7;
      --bg-2: #dbe7c9;
      --ink: #102a43;
      --ink-soft: rgba(16,42,67,.62);
      --accent: #ef5b5b;
      --accent-2: #2a9d8f;
      --panel: rgba(255,255,255,.9);
      --border: rgba(16,42,67,.13);
      --shadow: 0 4px 16px rgba(16,42,67,.10);
      --shadow-lg: 0 16px 40px rgba(16,42,67,.16);
      --r: 12px;
      --r-lg: 16px;
    }
    *,*::before,*::after { box-sizing: border-box; margin:0; padding:0; }
    body {
      min-height: 100vh;
      color: var(--ink);
      font-family: "Space Grotesk","IBM Plex Sans","Segoe UI",system-ui,sans-serif;
      font-size: 15px;
      line-height: 1.5;
      background:
        radial-gradient(circle at 12% 20%, rgba(239,91,91,.18), transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(42,157,143,.18), transparent 42%),
        linear-gradient(145deg, var(--bg), var(--bg-2));
    }
    .app-header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(242,239,231,.92);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
    }
    .header-inner {
      max-width: 1060px; margin: 0 auto; padding: 0 20px;
      height: 56px; display: flex; align-items: center; gap: 16px;
    }
    .brand {
      font-weight: 800; font-size: 1.1rem; letter-spacing: -.01em;
      color: var(--ink); text-decoration: none; flex-shrink: 0;
    }
    .brand em { color: var(--accent); font-style: normal; }
    .header-nav { display: flex; gap: 2px; flex: 1; }
    .nav-btn {
      border: 0; background: none; border-radius: 8px;
      padding: 6px 14px; font: inherit; font-size: .88rem; font-weight: 600;
      color: var(--ink-soft); cursor: pointer;
      transition: background .14s, color .14s;
    }
    .nav-btn:hover { background: rgba(16,42,67,.08); color: var(--ink); }
    .nav-btn.active { background: rgba(16,42,67,.1); color: var(--ink); }
    .header-account { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .acct-name { font-size: .85rem; font-weight: 700; color: var(--ink); }
    .main { max-width: 1060px; margin: 0 auto; padding: 24px 16px 56px; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--r-lg); box-shadow: var(--shadow); padding: 20px;
    }
    .card + .card { margin-top: 14px; }
    .card-title { font-size: 1rem; font-weight: 700; margin-bottom: 12px; }
    .card-sub { font-size: .82rem; color: var(--ink-soft); margin-bottom: 14px; }
    .g2 { display: grid; grid-template-columns: repeat(auto-fit,minmax(300px,1fr)); gap: 14px; }
    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    label {
      display: block; font-size: .76rem; font-weight: 700;
      margin-bottom: 5px; color: var(--ink-soft);
      text-transform: uppercase; letter-spacing: .04em;
    }
    input[type=text],input[type=password],input[type=date],select,textarea {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--r);
      padding: 10px 12px; font: inherit; font-size: .93rem;
      background: rgba(255,255,255,.96); outline: none;
      transition: border-color .14s, box-shadow .14s;
    }
    input:focus,select:focus,textarea:focus {
      border-color: var(--accent-2); box-shadow: 0 0 0 3px rgba(42,157,143,.12);
    }
    textarea { min-height: 120px; resize: vertical; }
    .btn {
      display: inline-flex; align-items: center; gap: 5px;
      border: 0; border-radius: var(--r); padding: 9px 16px;
      font: inherit; font-size: .88rem; font-weight: 700;
      cursor: pointer; transition: filter .14s, transform .1s; text-decoration: none;
    }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
    .btn-primary { background: linear-gradient(120deg,var(--accent),#f26d6d); color:#fff; }
    .btn-teal { background: linear-gradient(120deg,var(--accent-2),#3ab5a9); color:#fff; }
    .btn-ghost { background: rgba(16,42,67,.08); color: var(--ink); }
    .btn-ghost:hover { background: rgba(16,42,67,.14); filter: none; }
    .btn-outline-red {
      background: transparent; border: 1.5px solid #d17a7a; color: #c55;
      border-radius: var(--r); padding: 6px 12px;
      font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer;
      transition: background .14s, color .14s;
    }
    .btn-outline-red:hover { background: #d17a7a; color: #fff; }
    .btn-sm { padding: 6px 12px; font-size: .82rem; }
    .btn-full { width: 100%; justify-content: center; }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .search-row { display: flex; gap: 8px; align-items: flex-end; }
    .search-row input { flex: 1; }
    .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .filter-row select { flex: 1; min-width: 140px; }
    .results { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .r-card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--r); padding: 12px 14px;
      transition: border-color .14s, box-shadow .14s;
    }
    .r-card:hover { border-color: var(--accent-2); box-shadow: 0 3px 12px rgba(42,157,143,.12); }
    .r-name { font-weight: 700; font-size: .95rem; margin-bottom: 3px; }
    .r-desc { font-size: .82rem; color: var(--ink-soft); margin-bottom: 6px; }
    .chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .chip {
      background: rgba(42,157,143,.11); color: var(--accent-2);
      border-radius: 6px; padding: 2px 8px; font-size: .74rem; font-weight: 700;
    }
    .pagination {
      display: flex; align-items: center;
      justify-content: space-between; margin-top: 14px; gap: 8px;
    }
    .page-info { font-size: .8rem; color: var(--ink-soft); }
    .tok-list { display: flex; flex-direction: column; gap: 8px; }
    .tok-row {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px;
      background: var(--panel); border: 1px solid var(--border); border-radius: var(--r);
    }
    .tok-info { flex: 1; min-width: 0; }
    .tok-name { font-weight: 700; font-size: .9rem; }
    .tok-meta { font-size: .76rem; color: var(--ink-soft); display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
    .tok-expired { color: var(--accent); }
    .new-tok-form {
      background: rgba(42,157,143,.05); border: 1.5px dashed rgba(42,157,143,.35);
      border-radius: var(--r-lg); padding: 16px; margin-top: 14px;
    }
    .new-tok-row { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: flex-end; }
    .tok-reveal {
      background: rgba(42,157,143,.06); border: 1.5px solid rgba(42,157,143,.35);
      border-radius: var(--r-lg); padding: 16px; margin-top: 14px;
    }
    .tok-reveal-warn { font-size: .84rem; font-weight: 700; color: var(--accent-2); margin-bottom: 10px; }
    .tok-reveal-row { display: flex; gap: 8px; align-items: center; }
    .tok-value {
      flex: 1; font-family: "IBM Plex Mono",Consolas,monospace; font-size: .82rem;
      background: rgba(16,42,67,.05); border: 1px solid var(--border); border-radius: 8px;
      padding: 9px 12px; word-break: break-all; color: var(--ink);
    }
    .auth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .profile-bar {
      display: flex; align-items: center; gap: 14px; padding: 14px 18px;
      background: rgba(42,157,143,.07); border: 1px solid rgba(42,157,143,.22);
      border-radius: var(--r-lg); margin-bottom: 20px;
    }
    .profile-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(120deg,var(--accent-2),#3ab5a9);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1rem; color: #fff; flex-shrink: 0;
    }
    .profile-info { flex: 1; }
    .profile-name { font-weight: 700; font-size: .95rem; }
    .profile-sub { font-size: .78rem; color: var(--ink-soft); }
    .alert { padding: 10px 14px; border-radius: var(--r); font-size: .84rem; margin-bottom: 12px; }
    .alert-ok { background: rgba(42,157,143,.12); color: #1a7a6e; border: 1px solid rgba(42,157,143,.3); }
    .alert-err { background: rgba(239,91,91,.12); color: #c0392b; border: 1px solid rgba(239,91,91,.3); }
    .empty { text-align: center; padding: 28px 16px; color: var(--ink-soft); font-size: .86rem; }
    .log {
      font-family: "IBM Plex Mono",Consolas,monospace; font-size: .8rem;
      background: rgba(16,42,67,.95); color: #f1f5f9; border-radius: var(--r-lg);
      padding: 14px; min-height: 80px; max-height: 240px;
      overflow-y: auto; white-space: pre-wrap; margin-top: 14px;
    }
    .sec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .sec-title { font-weight: 700; font-size: .95rem; }
    .hidden { display: none !important; }
    .mt-8 { margin-top: 8px; } .mt-12 { margin-top: 12px; } .mt-14 { margin-top: 14px; }
    .txt-soft { color: var(--ink-soft); } .txt-sm { font-size: .82rem; }
    .unavailable-banner {
      padding: 24px; text-align: center; background: rgba(16,42,67,.04);
      border: 1px solid var(--border); border-radius: var(--r-lg);
      color: var(--ink-soft); font-size: .88rem;
    }
    @media(max-width:680px) {
      .auth-grid,.new-tok-row,.g2 { grid-template-columns: 1fr; }
      .header-nav .nav-btn { padding: 6px 8px; font-size: .8rem; }
    }
  </style>
</head>
<body>

  <header class="app-header">
    <div class="header-inner">
      <a class="brand" href="/">ai<em>-tools</em></a>
      <nav class="header-nav">
        <button class="nav-btn active" data-tab="explore">Explore</button>
        <button class="nav-btn" data-tab="account">Account</button>
      </nav>
      <div class="header-account">
        <span class="acct-name hidden" id="hdrUsername"></span>
        <button class="btn btn-ghost btn-sm hidden" id="hdrSignOut">Sign out</button>
        <button class="nav-btn" id="hdrSignIn">Sign in</button>
      </div>
    </div>
  </header>

  <main class="main">

    <!-- EXPLORE -->
    <div id="panel-explore" class="tab-panel active">
      <div class="card">
        <div class="search-row">
          <input type="text" id="searchQuery" placeholder="Search skills, agents, prompts..." />
          <button class="btn btn-teal" id="searchBtn">Search</button>
        </div>
        <div class="filter-row">
          <select id="searchSort" aria-label="Sort order">
            <option value="age:desc">Newest first</option>
            <option value="age:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
          </select>
          <select id="searchPageSize" aria-label="Results per page" style="max-width:130px;">
            <option value="5">5 / page</option>
            <option value="10" selected>10 / page</option>
            <option value="20">20 / page</option>
          </select>
        </div>
      </div>

      <div class="card mt-12 hidden" id="registriesCard">
        <div class="sec-header"><span class="sec-title">Registries</span></div>
        <div id="registriesList" class="results"></div>
      </div>

      <div class="card mt-12">
        <div class="sec-header">
          <span class="sec-title">Results</span>
          <span class="txt-sm txt-soft" id="searchPageInfo"></span>
        </div>
        <div id="searchResults" class="results"><div class="empty">Searching\u2026</div></div>
        <div class="pagination">
          <button class="btn btn-ghost btn-sm" id="searchPrev" disabled>\u2190 Prev</button>
          <button class="btn btn-ghost btn-sm" id="searchNext" disabled>Next \u2192</button>
        </div>
      </div>
    </div>

    <!-- ACCOUNT -->
    <div id="panel-account" class="tab-panel">

      <div id="acctGuest">
        <div id="authUnavailable" class="unavailable-banner hidden">
          <strong>Account management is not available</strong><br>
          This registry uses static tokens. Contact your administrator for credentials.
        </div>
        <div id="authForms" class="auth-grid">
          <div class="card">
            <div class="card-title">Sign In</div>
            <div id="loginAlert"></div>
            <div class="field">
              <label>Username</label>
              <input type="text" id="loginUser" autocomplete="username" />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" id="loginPass" autocomplete="current-password" />
            </div>
            <button class="btn btn-primary btn-full mt-12" id="loginBtn">Sign In</button>
          </div>
          <div class="card">
            <div class="card-title">Create Account</div>
            <div id="registerAlert"></div>
            <div class="field">
              <label>Username</label>
              <input type="text" id="regUser" autocomplete="username" />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" id="regPass" autocomplete="new-password" />
            </div>
            <button class="btn btn-teal btn-full mt-12" id="registerBtn">Create Account</button>
          </div>
        </div>
      </div>

      <div id="acctDash" class="hidden">
        <div class="profile-bar">
          <div class="profile-avatar" id="profAvatar">?</div>
          <div class="profile-info">
            <div class="profile-name" id="profName"></div>
            <div class="profile-sub" id="profOrg"></div>
          </div>
          <button class="btn btn-ghost btn-sm" id="dashSignOut">Sign out</button>
        </div>

        <!-- Personal Access Tokens -->
        <div class="card">
          <div class="sec-header">
            <span class="card-title" style="margin:0">Personal Access Tokens</span>
            <button class="btn btn-teal btn-sm" id="newTokBtn">+ New Token</button>
          </div>
          <p class="txt-sm txt-soft mt-8">
            Tokens authenticate the CLI and CI/CD pipelines. Scoped to an org, revocable any time.
          </p>

          <div class="new-tok-form hidden" id="newTokForm">
            <div class="new-tok-row">
              <div class="field" style="margin:0">
                <label>Token name</label>
                <input type="text" id="ntName" placeholder="e.g. ci-pipeline" />
              </div>
              <div class="field" style="margin:0">
                <label for="ntOrg">Org</label>
                <select id="ntOrg" aria-label="Organisation"></select>
              </div>
              <div class="field" style="margin:0">
                <label for="ntExpiry">Expires in</label>
                <select id="ntExpiry" aria-label="Token expiry">
                  <option value="">No expiry</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="custom">Custom date\u2026</option>
                </select>
              </div>
              <div>
                <button class="btn btn-primary" id="createTokBtn">Create</button>
              </div>
            </div>
            <div class="field hidden mt-8" id="ntCustomField">
              <label>Custom expiry date</label>
              <input type="date" id="ntCustomDate" />
            </div>
          </div>

          <div id="tokReveal" class="tok-reveal hidden">
            <div class="tok-reveal-warn">\u26a0 Copy your new token now \u2014 it will not be shown again.</div>
            <div class="tok-reveal-row">
              <div class="tok-value" id="tokRevealVal"></div>
              <button class="btn btn-teal btn-sm" id="copyTokBtn">Copy</button>
            </div>
            <p class="txt-sm txt-soft mt-8">
              CLI usage: <code>ai-tools config registry add &lt;name&gt; &lt;url&gt; --token &lt;TOKEN&gt;</code>
            </p>
          </div>

          <div id="tokList" class="tok-list mt-12"><div class="empty">Loading tokens\u2026</div></div>
        </div>

        <!-- Org tools -->
        <div class="card mt-14">
          <div class="sec-header">
            <span class="card-title" style="margin:0">Your Org's Tools</span>
            <button class="btn btn-ghost btn-sm" id="loadOrgToolsBtn">Refresh</button>
          </div>
          <div id="orgToolsList" class="results"><div class="empty">Click Refresh to load tools</div></div>
        </div>

        <!-- Tool management -->
        <div class="card mt-14">
          <div class="card-title">Tool Management</div>
          <p class="card-sub">Deprecate or unpublish tools owned by your org.</p>
          <div class="g2">
            <div class="field">
              <label>Tool Name</label>
              <input type="text" id="mgmtName" placeholder="my-skill" />
            </div>
            <div class="field">
              <label>Version (required to deprecate)</label>
              <input type="text" id="mgmtVer" placeholder="1.0.0" />
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="deprecateBtn">Deprecate</button>
            <button class="btn btn-ghost" id="unpublishBtn">Unpublish</button>
          </div>
          <div class="log" id="mgmtLog" style="min-height:60px">Ready.</div>
        </div>
      </div>
    </div>

  </main>

  <script>
    var TOK_KEY  = 'ai-tools.portal.token';
    var ORG_KEY  = 'ai-tools.portal.org';
    var USER_KEY = 'ai-tools.portal.username';
    var authToken    = localStorage.getItem(TOK_KEY)  || '';
    var authOrg      = localStorage.getItem(ORG_KEY)  || '';
    var authUsername = localStorage.getItem(USER_KEY) || '';
    var searchPage   = 1;
    var searchTotal  = 1;

    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function relExpiry(iso) {
      if (!iso) return 'Never expires';
      var d = new Date(iso), now = new Date();
      if (d < now) return 'Expired ' + d.toLocaleDateString();
      var days = Math.ceil((d - now) / 86400000);
      if (days === 1) return 'Expires tomorrow';
      if (days < 30)  return 'Expires in ' + days + ' day(s)';
      return 'Expires ' + d.toLocaleDateString();
    }
    function showAlert(el, msg, type) {
      el.innerHTML = '<div class="alert alert-' + (type || 'err') + '">' + esc(msg) + '</div>';
      setTimeout(function(){ el.innerHTML = ''; }, 5000);
    }

    function apiFetch(path, opts) {
      opts = opts || {};
      var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (authToken && !('Authorization' in (opts.headers || {}))) headers['Authorization'] = 'Bearer ' + authToken;
      if (authOrg && !('x-ai-tools-org' in (opts.headers || {})))  headers['x-ai-tools-org'] = authOrg;
      return fetch(path, Object.assign({}, opts, { headers: headers })).then(function(res) {
        return res.text().then(function(text) {
          var body; try { body = JSON.parse(text); } catch(e) { body = text; }
          return { status: res.status, body: body };
        });
      });
    }

    // Tab navigation
    function switchTab(name) {
      document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
      document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.toggle('active', p.id === 'panel-' + name); });
    }
    document.querySelectorAll('.nav-btn[data-tab]').forEach(function(btn){
      btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });
    document.getElementById('hdrSignIn').addEventListener('click', function(){ switchTab('account'); });

    // Auth state
    function setAuth(token, org, username) {
      authToken = token || ''; authOrg = org || ''; authUsername = username || '';
      localStorage.setItem(TOK_KEY, authToken);
      localStorage.setItem(ORG_KEY, authOrg);
      localStorage.setItem(USER_KEY, authUsername);
      updateAuthUI();
    }
    function clearAuth() { setAuth('', '', ''); }

    function updateAuthUI() {
      var authed = Boolean(authToken);
      var hdrName = document.getElementById('hdrUsername');
      hdrName.textContent = authUsername;
      hdrName.classList.toggle('hidden', !authed);
      document.getElementById('hdrSignOut').classList.toggle('hidden', !authed);
      document.getElementById('hdrSignIn').classList.toggle('hidden', authed);
      document.getElementById('acctGuest').classList.toggle('hidden', authed);
      document.getElementById('acctDash').classList.toggle('hidden', !authed);
      if (authed) {
        document.getElementById('profAvatar').textContent = (authUsername || '?')[0].toUpperCase();
        document.getElementById('profName').textContent   = authUsername;
        document.getElementById('profOrg').textContent    = authOrg ? 'Org: ' + authOrg : 'No org selected';
        loadTokens();
      }
    }

    function checkAuthAvailable() {
      fetch('/api/auth/tokens').then(function(r) {
        if (r.status === 404) {
          document.getElementById('authForms').classList.add('hidden');
          document.getElementById('authUnavailable').classList.remove('hidden');
        }
      }).catch(function(){});
    }

    // Login
    document.getElementById('loginBtn').addEventListener('click', function() {
      var u = document.getElementById('loginUser').value.trim();
      var p = document.getElementById('loginPass').value;
      var alertEl = document.getElementById('loginAlert');
      if (!u || !p) { showAlert(alertEl, 'Username and password required'); return; }
      apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }), headers: { Authorization: '' } })
        .then(function(r) {
          if (r.status === 200) { setAuth(r.body.token, r.body.org, r.body.username); document.getElementById('loginPass').value = ''; }
          else showAlert(alertEl, r.body.error || 'Login failed');
        });
    });
    document.getElementById('loginPass').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('loginBtn').click(); });

    // Register
    document.getElementById('registerBtn').addEventListener('click', function() {
      var u = document.getElementById('regUser').value.trim();
      var p = document.getElementById('regPass').value;
      var alertEl = document.getElementById('registerAlert');
      if (!u || !p) { showAlert(alertEl, 'Username and password required'); return; }
      apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }), headers: { Authorization: '' } })
        .then(function(r1) {
          if (r1.status !== 201) { showAlert(alertEl, r1.body.error || 'Registration failed'); return; }
          return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }), headers: { Authorization: '' } })
            .then(function(r2) {
              if (r2.status === 200) { setAuth(r2.body.token, r2.body.org, r2.body.username); document.getElementById('regPass').value = ''; }
              else showAlert(alertEl, 'Account created — please sign in.', 'ok');
            });
        });
    });
    document.getElementById('regPass').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('registerBtn').click(); });

    document.getElementById('hdrSignOut').addEventListener('click', clearAuth);
    document.getElementById('dashSignOut').addEventListener('click', clearAuth);

    // Tokens
    function loadTokens() {
      apiFetch('/api/auth/tokens').then(function(r) {
        var listEl = document.getElementById('tokList');
        if (r.status === 200) {
          var tokens = r.body.tokens || [];
          if (!tokens.length) {
            listEl.innerHTML = '<div class="empty">No tokens yet. Create one to use with the CLI.</div>';
          } else {
            listEl.innerHTML = tokens.map(function(t) {
              var expired = t.expiresAt && new Date(t.expiresAt) < new Date();
              return '<div class="tok-row">'
                + '<div class="tok-info">'
                + '<div class="tok-name">' + esc(t.description || 'Unnamed token') + '</div>'
                + '<div class="tok-meta">'
                + '<span>' + esc(t.org) + '</span>'
                + '<span>Created ' + new Date(t.createdAt).toLocaleDateString() + '</span>'
                + '<span class="' + (expired ? 'tok-expired' : '') + '">' + relExpiry(t.expiresAt) + '</span>'
                + '</div></div>'
                + '<button class="btn-outline-red" data-id="' + t.id + '">Revoke</button>'
                + '</div>';
            }).join('');
            listEl.querySelectorAll('[data-id]').forEach(function(btn) {
              btn.addEventListener('click', function(){ revokeToken(Number(btn.dataset.id)); });
            });
          }
        } else if (r.status === 401) { listEl.innerHTML = '<div class="empty">Session expired.</div>'; clearAuth(); }
        else { listEl.innerHTML = '<div class="empty">Failed to load tokens.</div>'; }
      });
    }

    function revokeToken(id) {
      if (!confirm('Revoke this token? This cannot be undone.')) return;
      apiFetch('/api/auth/tokens/' + id, { method: 'DELETE' }).then(function(r) {
        if (r.status === 200) loadTokens();
        else alert('Failed to revoke: ' + (r.body.error || 'Unknown error'));
      });
    }

    document.getElementById('newTokBtn').addEventListener('click', function() {
      var form = document.getElementById('newTokForm');
      var visible = !form.classList.contains('hidden');
      form.classList.toggle('hidden', visible);
      document.getElementById('tokReveal').classList.add('hidden');
      if (!visible) {
        apiFetch('/api/org/info').then(function(r) {
          var sel = document.getElementById('ntOrg');
          sel.innerHTML = '';
          var orgs = (r.status === 200 && r.body.memberOrgs && r.body.memberOrgs.length)
            ? r.body.memberOrgs : (authOrg ? [authOrg] : []);
          orgs.forEach(function(o) {
            var opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === authOrg) opt.selected = true;
            sel.appendChild(opt);
          });
          if (!orgs.length) {
            var opt = document.createElement('option'); opt.value = ''; opt.textContent = '(none)'; sel.appendChild(opt);
          }
        });
      }
    });

    document.getElementById('ntExpiry').addEventListener('change', function() {
      document.getElementById('ntCustomField').classList.toggle('hidden', this.value !== 'custom');
    });

    document.getElementById('createTokBtn').addEventListener('click', function() {
      var name   = document.getElementById('ntName').value.trim();
      var org    = document.getElementById('ntOrg').value;
      var expiry = document.getElementById('ntExpiry').value;
      var custom = document.getElementById('ntCustomDate').value;
      if (!name) { alert('Token name is required'); return; }
      var expiresAt = null;
      if (expiry === 'custom') {
        if (!custom) { alert('Please select a custom expiry date'); return; }
        expiresAt = new Date(custom + 'T23:59:59').toISOString();
      } else if (expiry) {
        var d = new Date(); d.setDate(d.getDate() + Number(expiry)); expiresAt = d.toISOString();
      }
      apiFetch('/api/auth/tokens', { method: 'POST', body: JSON.stringify({ org: org, description: name, expiresAt: expiresAt }) })
        .then(function(r) {
          if (r.status === 201) {
            document.getElementById('tokRevealVal').textContent = r.body.token;
            document.getElementById('tokReveal').classList.remove('hidden');
            document.getElementById('newTokForm').classList.add('hidden');
            document.getElementById('ntName').value = '';
            document.getElementById('ntExpiry').value = '';
            document.getElementById('ntCustomField').classList.add('hidden');
            loadTokens();
          } else { alert('Failed to create token: ' + (r.body.error || 'Unknown error')); }
        });
    });

    document.getElementById('copyTokBtn').addEventListener('click', function() {
      var val = document.getElementById('tokRevealVal').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(function() {
          document.getElementById('copyTokBtn').textContent = 'Copied!';
          setTimeout(function(){ document.getElementById('copyTokBtn').textContent = 'Copy'; }, 2000);
        });
      }
    });

    // Org tools
    document.getElementById('loadOrgToolsBtn').addEventListener('click', function() {
      apiFetch('/api/org/tools').then(function(r) {
        var listEl = document.getElementById('orgToolsList');
        if (r.status === 200) {
          var tools = r.body.tools || [];
          if (!tools.length) { listEl.innerHTML = '<div class="empty">No tools published yet</div>'; return; }
          listEl.innerHTML = tools.map(function(t) {
            return '<div class="r-card"><div class="r-name">' + esc(t.name) + '</div>'
              + (t.description ? '<div class="r-desc">' + esc(t.description) + '</div>' : '')
              + '<div class="chips mt-8"><span class="chip">v' + esc(t.latestVersion) + '</span>'
              + '<span class="chip">' + esc(t.category || 'tool') + '</span>'
              + '<span class="chip">' + t.allVersions.length + ' version(s)</span></div></div>';
          }).join('');
        } else { listEl.innerHTML = '<div class="empty">Error: ' + esc(r.body.error || 'Cannot load tools') + '</div>'; }
      });
    });

    document.getElementById('deprecateBtn').addEventListener('click', function() {
      var name = document.getElementById('mgmtName').value.trim();
      var ver  = document.getElementById('mgmtVer').value.trim();
      var log  = document.getElementById('mgmtLog');
      if (!name || !ver) { log.textContent = 'Tool name and version required.'; return; }
      apiFetch('/api/org/tools/' + encodeURIComponent(name) + '/deprecate?version=' + encodeURIComponent(ver), { method: 'POST' })
        .then(function(r){ log.textContent = JSON.stringify(r.body, null, 2); });
    });

    document.getElementById('unpublishBtn').addEventListener('click', function() {
      var name = document.getElementById('mgmtName').value.trim();
      var ver  = document.getElementById('mgmtVer').value.trim();
      var log  = document.getElementById('mgmtLog');
      if (!name) { log.textContent = 'Tool name required.'; return; }
      var url = ver
        ? '/api/org/tools/' + encodeURIComponent(name) + '/unpublish?version=' + encodeURIComponent(ver)
        : '/api/org/tools/' + encodeURIComponent(name) + '/unpublish';
      apiFetch(url, { method: 'POST' }).then(function(r){ log.textContent = JSON.stringify(r.body, null, 2); });
    });

    // Search
    function runSearch(page) {
      var q       = encodeURIComponent(document.getElementById('searchQuery').value || '');
      var sortVal = (document.getElementById('searchSort').value || 'age:desc').split(':');
      var pgSize  = document.getElementById('searchPageSize').value || '10';
      var path = '/api/search/all?q=' + q
        + '&sortBy='   + encodeURIComponent(sortVal[0])
        + '&sortDir='  + encodeURIComponent(sortVal[1] || 'desc')
        + '&page='     + String(page || 1)
        + '&pageSize=' + encodeURIComponent(pgSize);
      apiFetch(path, { headers: { Authorization: '' } }).then(function(r) {
        var resultsEl = document.getElementById('searchResults');
        var infoEl    = document.getElementById('searchPageInfo');
        if (r.status === 200 && r.body.results) {
          var tools = r.body.results;
          searchPage  = r.body.page  || page;
          searchTotal = r.body.totalPages || 1;
          infoEl.textContent = 'Page ' + searchPage + ' of ' + searchTotal + ' \u00b7 ' + (r.body.total || 0) + ' result(s)';
          document.getElementById('searchPrev').disabled = searchPage <= 1;
          document.getElementById('searchNext').disabled = searchPage >= searchTotal;
          if (!tools.length) { resultsEl.innerHTML = '<div class="empty">No results found</div>'; return; }
          resultsEl.innerHTML = tools.map(function(t) {
            return '<div class="r-card"><div class="r-name">' + esc(t.name) + '</div>'
              + (t.description ? '<div class="r-desc">' + esc(t.description) + '</div>' : '')
              + '<div class="chips mt-8"><span class="chip">' + esc(t.version||'?') + '</span>'
              + '<span class="chip">' + esc(t.category||'tool') + '</span>'
              + '<span class="chip">' + esc(t.source||'local') + '</span></div>'
              + '<div class="mt-8"><a class="btn btn-primary btn-sm" href="/portal/skills/' + encodeURIComponent(t.name) + '">View details</a></div>'
              + '</div>';
          }).join('');
        } else { resultsEl.innerHTML = '<div class="empty">Failed to load results</div>'; }
      });
    }

    document.getElementById('searchBtn').addEventListener('click', function(){ runSearch(1); });
    document.getElementById('searchQuery').addEventListener('keydown', function(e){ if(e.key==='Enter') runSearch(1); });
    document.getElementById('searchSort').addEventListener('change', function(){ runSearch(1); });
    document.getElementById('searchPageSize').addEventListener('change', function(){ runSearch(1); });
    document.getElementById('searchPrev').addEventListener('click', function(){ if(searchPage>1) runSearch(searchPage-1); });
    document.getElementById('searchNext').addEventListener('click', function(){ if(searchPage<searchTotal) runSearch(searchPage+1); });

    // Registries
    function loadRegistries() {
      apiFetch('/api/registries', { headers: { Authorization: '' } }).then(function(r) {
        if (r.status === 200 && r.body.registries && r.body.registries.length) {
          document.getElementById('registriesCard').classList.remove('hidden');
          document.getElementById('registriesList').innerHTML = r.body.registries.map(function(reg) {
            return '<div class="r-card"><div class="r-name">' + esc(reg.name) + '</div>'
              + '<div class="chips mt-8"><span class="chip">' + (reg.isLocal ? 'Local' : 'Upstream') + '</span></div>'
              + '<div class="txt-sm txt-soft mt-8" style="font-family:monospace">' + esc(reg.url) + '</div></div>';
          }).join('');
        }
      }).catch(function(){});
    }

    // Init
    updateAuthUI();
    checkAuthAvailable();
    loadRegistries();
    runSearch(1);
  </script>
</body>
</html>`;
