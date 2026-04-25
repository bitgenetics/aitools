import https from 'node:https';
import http from 'node:http';
import type { ToolManifest } from '@ai-tools/core';
import type { RegistryConfig } from '@ai-tools/core';

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

export interface RegistryClient {
  config: RegistryConfig;
  getManifest(name: string, version?: string): Promise<ToolManifest>;
  search(query: string): Promise<SearchResult[]>;
  download(name: string, version: string): Promise<Buffer>;
  publish(manifest: ToolManifest, files: Record<string, string>): Promise<PublishResult>;
}

/**
 * HTTP client for a single registry endpoint.
 * All requests include the Authorization header when auth is configured.
 */
export function createRegistryClient(config: RegistryConfig): RegistryClient {
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
      return getJSON<ToolManifest>(`/tools/${encoded}/${version}`);
    },
    async search(query: string): Promise<SearchResult[]> {
      const q = encodeURIComponent(query);
      const results = await getJSON<SearchResult[]>(`/search?q=${q}`);
      return results.map((r) => ({ ...r, registry: config.url }));
    },
    async download(name: string, version: string): Promise<Buffer> {
      const encoded = encodeURIComponent(name);
      return request(`${base}/tools/${encoded}/${version}/tarball`);
    },
    async publish(manifest: ToolManifest, files: Record<string, string>): Promise<PublishResult> {
      const body = JSON.stringify({ manifest, files });
      const headers = buildHeaders();
      headers['Content-Length'] = Buffer.byteLength(body).toString();
      return new Promise((resolve, reject) => {
        const parsed = new URL(`${base}/tools`);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request(
          { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST', headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              const json: unknown = JSON.parse(text);
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