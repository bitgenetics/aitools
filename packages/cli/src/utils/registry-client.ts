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
import https from 'node:https';
import http from 'node:http';
import type { ToolManifest, RegistryConfig, GitRegistryConfig, HttpRegistryConfig } from '@ai-tools/core';
import { isGitRegistryConfig } from '@ai-tools/core';
import { createGitRegistryClient } from './git-registry-client.js';

export interface SearchResult {
  name: string;
  version: string;
  description: string;
  category: string;
  keywords?: string[];
  registry: string;
}

export interface PublishResult {
  name: string;
  version: string;
  integrity: string;
}

export interface DownloadResult {
  data: Buffer;
  /** Server-reported integrity hash (X-Integrity header). May be absent for older registries. */
  integrity?: string;
}

export interface RegistryClient {
  config: RegistryConfig;
  getManifest(name: string, version?: string): Promise<ToolManifest>;
  listVersions(name: string): Promise<string[]>;
  search(query: string): Promise<SearchResult[]>;
  download(name: string, version: string): Promise<DownloadResult>;
  publish(manifest: ToolManifest, files: Record<string, string>): Promise<PublishResult>;
}

/**
 * HTTP client for a single registry endpoint.
 * All requests include the Authorization header when auth is configured.
 */
export function createHttpRegistryClient(config: HttpRegistryConfig): RegistryClient {
  const base = config.url.replace(/\/$/, '');

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.auth) {
      if (config.auth.type === 'bearer' && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`;
      } else if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
        const creds = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      }
    }
    return headers;
  }

  function request(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const headers = buildHeaders();

      lib.get(url, { headers }, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error(`Registry ${config.name}: authentication required (${res.statusCode})`));
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Registry ${config.name}: HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async function getJSON<T>(path: string): Promise<T> {
    const buf = await request(`${base}${path}`);
    return JSON.parse(buf.toString('utf8')) as T;
  }

  return {
    config,
    async getManifest(name: string, version = 'latest'): Promise<ToolManifest> {
      const encoded = encodeURIComponent(name);
      return getJSON<ToolManifest>(`/api/tools/${encoded}/${version}`);
    },
    async listVersions(name: string): Promise<string[]> {
      const encoded = encodeURIComponent(name);
      const result = await getJSON<{ name: string; versions: string[] }>(`/api/tools/${encoded}/versions`);
      return result.versions;
    },
    async search(query: string): Promise<SearchResult[]> {
      const q = encodeURIComponent(query);
      const results = await getJSON<SearchResult[]>(`/api/search?q=${q}`);
      return results.map((r) => ({ ...r, registry: config.url }));
    },
    async download(name: string, version: string): Promise<DownloadResult> {
      const encoded = encodeURIComponent(name);
      const url = `${base}/api/tools/${encoded}/${version}/tarball`;
      return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const headers = buildHeaders();

        lib.get(url, { headers }, (res) => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`Registry ${config.name}: authentication required (${res.statusCode})`));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Registry ${config.name}: HTTP ${res.statusCode} for ${url}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            const integrity = res.headers['x-integrity'] as string | undefined;
            resolve({ data, integrity });
          });
          res.on('error', reject);
        }).on('error', reject);
      });
    },
    async publish(manifest: ToolManifest, files: Record<string, string>): Promise<PublishResult> {
      const body = JSON.stringify({ manifest, files });
      const headers = buildHeaders();
      headers['Content-Length'] = Buffer.byteLength(body).toString();
      return new Promise((resolve, reject) => {
        const parsed = new URL(`${base}/api/tools`);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request(
          { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST', headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              let json: unknown;
              try {
                json = JSON.parse(text);
              } catch {
                reject(new Error(`Registry ${config.name}: unexpected non-JSON response (HTTP ${res.statusCode}): ${text.slice(0, 200)}`));
                return;
              }
              if (res.statusCode === 201) {
                resolve(json as PublishResult);
              } else {
                const msg = (json as { error?: string }).error ?? `HTTP ${res.statusCode}`;
                reject(new Error(`Registry ${config.name}: ${msg}`));
              }
            });
            res.on('error', reject);
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    },
  };
}

/**
 * Create a registry client for the given config.
 * Dispatches to HTTP or git implementation based on `config.type`.
 */
export function createRegistryClient(config: RegistryConfig): RegistryClient {
  if (isGitRegistryConfig(config)) {
    return createGitRegistryClient(config);
  }
  return createHttpRegistryClient(config);
}