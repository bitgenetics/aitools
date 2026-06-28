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
 * AWS S3 storage provider (stub).
 *
 * To activate, install the AWS SDK:
 *   npm install @aws-sdk/client-s3
 *
 * Required environment variables:
 *   AWS_S3_BUCKET   — S3 bucket name (e.g. "ai-tools-registry")
 *   AWS_REGION      — AWS region (e.g. "us-east-1")
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  — or use IAM role (recommended for EC2/ECS)
 *
 * Object layout mirrors the local filesystem layout using "/" as key delimiters.
 * S3 has no real directories; the `list()` method uses prefix + delimiter queries.
 *
 * TODO: Replace the stub below with a real implementation once the AWS SDK
 * is installed and credentials are configured.
 *
 * Example skeleton:
 *
 * ```typescript
 * import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
 *
 * export class S3StorageProvider implements IStorageProvider {
 *   private client: S3Client;
 *
 *   constructor(private readonly bucket: string, region: string) {
 *     this.client = new S3Client({ region });
 *   }
 *
 *   async read(path: string): Promise<Buffer> {
 *     const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: path }));
 *     const chunks: Uint8Array[] = [];
 *     for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
 *     return Buffer.concat(chunks);
 *   }
 *
 *   async write(path: string, content: Buffer | string): Promise<void> {
 *     const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
 *     await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: path, Body: buf }));
 *   }
 *
 *   async exists(path: string): Promise<boolean> {
 *     // Use HeadObjectCommand for efficient existence check
 *   }
 *
 *   // ... implement remaining methods
 * }
 * ```
 */

import type { IStorageProvider, StorageEntry } from './types.js';

export class S3StorageProvider implements IStorageProvider {
  constructor(
    private readonly bucket: string,
    private readonly region: string,
  ) {}

  async read(_path: string): Promise<Buffer> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async readText(path: string): Promise<string> {
    return (await this.read(path)).toString('utf-8');
  }

  async write(_path: string, _content: Buffer | string): Promise<void> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async append(_path: string, _content: string): Promise<void> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async exists(_path: string): Promise<boolean> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async list(_path: string): Promise<StorageEntry[]> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async remove(_path: string, _opts?: { recursive?: boolean }): Promise<void> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async stat(_path: string): Promise<{ mtime: Date }> {
    throw new Error('S3StorageProvider not yet implemented. See comments in s3.ts.');
  }

  async ensureDir(_path: string): Promise<void> {
    // No-op: S3 has no real directories.
  }
}
