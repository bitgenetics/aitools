const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_FILE = path.join(os.tmpdir(), 'aitools-e2e-server-state.json');

/** @returns {Promise<void>} */
module.exports = async function globalTeardown() {
  const child = global.__AITOOLS_E2E_SERVER__;
  if (child && !child.killed) {
    child.kill();
  }

  if (!fs.existsSync(STATE_FILE)) return;

  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (state.started && state.dataDir && fs.existsSync(state.dataDir)) {
      fs.rmSync(state.dataDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(STATE_FILE, { force: true });
  }
};
