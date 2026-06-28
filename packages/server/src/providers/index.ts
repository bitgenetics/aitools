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
 * Provider registry — re-exports all storage and auth abstractions.
 *
 * Deployment mode guide:
 *
 *   Mode 1 — Local (cross-project AI-tool sharing, no external users)
 *     STORAGE_BACKEND=filesystem
 *     AUTH_BACKEND=simple
 *     AITOOLS_ADMIN_TOKEN=<token>
 *     AITOOLS_PUBLISHER_TOKENS=...
 *
 *   Mode 2 — Dev (local simulation of the deployed system)
 *     STORAGE_BACKEND=filesystem
 *     AUTH_BACKEND=database
 *     DATABASE_URL=postgresql://...
 *     AITOOLS_ADMIN_TOKEN=<token>
 *
 *   Mode 3 — Production (deployed, cloud storage, external auth)
 *     STORAGE_BACKEND=azure | s3
 *     AUTH_BACKEND=database | oidc
 *     DATABASE_URL=...                        (database backend)
 *     OIDC_ISSUER=...                        (oidc backend)
 *     OIDC_AUDIENCE=...                      (oidc backend)
 *     AZURE_STORAGE_CONNECTION_STRING=...    (azure storage)
 *     AZURE_STORAGE_CONTAINER=...            (azure storage)
 *     AWS_S3_BUCKET=...                      (s3 storage)
 *     AWS_REGION=...                         (s3 storage)
 */

export type { IStorageProvider, StorageEntry } from './storage/types.js';
export { LocalStorageProvider, AzureStorageProvider, S3StorageProvider, createStorageProvider } from './storage/index.js';
export type { StorageBackend, StorageProviderConfig } from './storage/index.js';

export type {
  IAuthProvider,
  IPublisherAuth,
  IAdminAuth,
  IUserManagement,
  AdminCheckInput,
  ManagedUser,
  ManagedTokenRecord,
  AuthMode,
} from './auth/types.js';
export {
  SimpleAuthProvider,
  DatabaseAuthProvider,
  OidcAuthProvider,
  createAuthProvider,
} from './auth/index.js';
export type { AuthBackend, AuthProviderConfig } from './auth/index.js';
