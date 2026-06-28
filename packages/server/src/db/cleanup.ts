// Copyright (C) 2026 Nucleic Logic Studios, LLC
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
import type { Pool } from 'pg';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Periodically delete expired auth tokens from the database.
 * Returns a cleanup function to stop the interval (useful for tests / shutdown).
 */
export function startTokenCleanup(pool: Pool): () => void {
  const run = async () => {
    try {
      const result = await pool.query(
        `DELETE FROM auth_tokens WHERE expires_at IS NOT NULL AND expires_at < now()`,
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`[aitools] Cleaned up ${result.rowCount} expired auth token(s).`);
      }
    } catch (err) {
      console.error('[aitools] Token cleanup failed:', err);
    }
  };

  // Run once immediately, then on interval
  void run();
  const timer = setInterval(() => void run(), CLEANUP_INTERVAL_MS);
  timer.unref(); // Don't prevent process exit

  return () => clearInterval(timer);
}
