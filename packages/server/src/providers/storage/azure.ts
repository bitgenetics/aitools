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
/**
 * Azure Blob Storage provider (stub).
 *
 * To activate, install the Azure SDK:
 *   npm install @azure/storage-blob
 *
 * Required environment variables:
 *   AZURE_STORAGE_CONNECTION_STRING  — connection string for the storage account
 *   AZURE_STORAGE_CONTAINER          — blob container name (e.g. "ai-tools-data")
 *
 * Object layout mirrors the local filesystem layout:
 *   "<tool-name>/<version>/manifest.json"
 *   "<tool-name>/<version>/files.json"
 *   "<tool-name>/owner.json"
 *   "orgs.json"
 *   "audit-log.jsonl"
 *
 * Implementation notes:
 *  - Azure Blob Storage has no real directories; paths with "/" separators are
 *    used to simulate directory structure.
 *  - `list(path)` uses a blob prefix query with a "/" delimiter to return
 *    "virtual directory" entries.
 *  - `append(path, content)` is implemented as a read-modify-write since
 *    Append Blobs have a different API; use an Azure Append Blob if you need
 *    true atomic appends.
 *
 * TODO: Replace the stub below with a real implementation once the Azure SDK
 * is installed and connection string is configured.
 *
 * Example skeleton:
 *
 * ```typescript
 * import { BlobServiceClient } from '@azure/storage-blob';
 *
 * export class AzureStorageProvider implements IStorageProvider {
 *   private client: BlobServiceClient;
 *   private container: string;
 *
 *   constructor(connectionString: string, container: string) {
 *     this.client = BlobServiceClient.fromConnectionString(connectionString);
 *     this.container = container;
 *   }
 *
 *   async read(path: string): Promise<Buffer> {
 *     const blob = this.client.getContainerClient(this.container).getBlobClient(path);
 *     const download = await blob.download();
 *     const chunks: Buffer[] = [];
 *     for await (const chunk of download.readableStreamBody!) {
 *       chunks.push(Buffer.from(chunk as Uint8Array));
 *     }
 *     return Buffer.concat(chunks);
 *   }
 *
 *   async write(path: string, content: Buffer | string): Promise<void> {
 *     const blockBlob = this.client
 *       .getContainerClient(this.container)
 *       .getBlockBlobClient(path);
 *     const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
 *     await blockBlob.upload(buf, buf.length, {
 *       blobHTTPHeaders: { blobContentType: 'application/json' },
 *     });
 *   }
 *
 *   // ... implement remaining methods
 * }
 * ```
 */

import type { IStorageProvider, StorageEntry } from './types.js';

export class AzureStorageProvider implements IStorageProvider {
  constructor(
    private readonly connectionString: string,
    private readonly container: string,
  ) {}

  async read(_path: string): Promise<Buffer> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async readText(path: string): Promise<string> {
    return (await this.read(path)).toString('utf-8');
  }

  async write(_path: string, _content: Buffer | string): Promise<void> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async append(_path: string, _content: string): Promise<void> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async exists(_path: string): Promise<boolean> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async list(_path: string): Promise<StorageEntry[]> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async remove(_path: string, _opts?: { recursive?: boolean }): Promise<void> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async stat(_path: string): Promise<{ mtime: Date }> {
    throw new Error('AzureStorageProvider not yet implemented. See comments in azure.ts.');
  }

  async ensureDir(_path: string): Promise<void> {
    // No-op: Azure Blob Storage has no real directories.
  }
}
