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
export type { IStorageProvider, StorageEntry } from './types.js';
export { LocalStorageProvider } from './local.js';
export { AzureStorageProvider } from './azure.js';
export { S3StorageProvider } from './s3.js';

export type StorageBackend = 'filesystem' | 'azure' | 's3';

export interface StorageProviderConfig {
  backend: StorageBackend;
  /** Root directory (filesystem backend only). Defaults to ./data. */
  rootDir?: string;
  /** Azure Blob Storage connection string (azure backend). */
  azureConnectionString?: string;
  /** Azure Blob Storage container name (azure backend). */
  azureContainer?: string;
  /** S3 bucket name (s3 backend). */
  s3Bucket?: string;
  /** AWS region (s3 backend). */
  s3Region?: string;
}

import type { IStorageProvider } from './types.js';
import { LocalStorageProvider } from './local.js';
import { AzureStorageProvider } from './azure.js';
import { S3StorageProvider } from './s3.js';
import path from 'node:path';
import { readEnv } from '../../env.js';

/**
 * Construct a storage provider from configuration.
 *
 * Reads from env vars when called without config:
 *   STORAGE_BACKEND=filesystem|azure|s3   (default: filesystem)
 *   AITOOLS_DATA_DIR
 *   AZURE_STORAGE_CONNECTION_STRING
 *   AZURE_STORAGE_CONTAINER
 *   AWS_S3_BUCKET
 *   AWS_REGION
 */
export function createStorageProvider(config?: StorageProviderConfig): IStorageProvider {
  const backend = config?.backend ?? (process.env['STORAGE_BACKEND'] as StorageBackend | undefined) ?? 'filesystem';

  switch (backend) {
    case 'filesystem': {
      const root =
        config?.rootDir ??
        readEnv('AITOOLS_DATA_DIR') ??
        path.resolve(process.cwd(), 'data');
      return new LocalStorageProvider(root);
    }

    case 'azure': {
      const connStr =
        config?.azureConnectionString ?? process.env['AZURE_STORAGE_CONNECTION_STRING'];
      const container =
        config?.azureContainer ?? process.env['AZURE_STORAGE_CONTAINER'];
      if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for azure storage backend');
      if (!container) throw new Error('AZURE_STORAGE_CONTAINER is required for azure storage backend');
      return new AzureStorageProvider(connStr, container);
    }

    case 's3': {
      const bucket = config?.s3Bucket ?? process.env['AWS_S3_BUCKET'];
      const region = config?.s3Region ?? process.env['AWS_REGION'] ?? 'us-east-1';
      if (!bucket) throw new Error('AWS_S3_BUCKET is required for s3 storage backend');
      return new S3StorageProvider(bucket, region);
    }

    default:
      throw new Error(`Unknown storage backend: "${backend as string}". Valid values: filesystem, azure, s3`);
  }
}
