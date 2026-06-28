# Setup Plan: GitHub Fork + Azure Deployment

**Target company profile**: Uses GitHub for source control, Azure for hosting services and infrastructure.

---

## Architecture Overview

| Concern | Azure Service |
|---|---|
| Container image | Azure Container Registry (ACR) |
| Runtime | Azure Container Apps |
| Database | Azure Database for PostgreSQL – Flexible Server |
| Storage | Azure Blob Storage |
| Secrets | Azure Key Vault |
| Identity / auth | Microsoft Entra ID (AAD) via OIDC |
| TLS termination | Azure Application Gateway (WAF) or Azure Front Door |
| CI/CD | GitHub Actions with Workload Identity Federation |

---

## Step 1 — Clone the Repository

Clone the canonical repository from the **bitgenetics** GitHub organization:

```bash
git clone https://github.com/bitgenetics/aitools
cd aitools
```

If you maintain a fork, track upstream for security patches:

```bash
git remote add upstream https://github.com/bitgenetics/aitools
git fetch upstream
git merge upstream/main
```

Schedule this merge periodically (e.g. monthly or on upstream release tags).

---

## Step 2 — Provision Azure Infrastructure

### 2a. Resource Group + Container Registry

```bash
az group create --name rg-aitools-prod --location eastus

az acr create \
  --resource-group rg-aitools-prod \
  --name acraitoolsprod \
  --sku Standard \
  --admin-enabled false        # use managed identity, not admin credentials
```

### 2b. PostgreSQL – Flexible Server

```bash
az postgres flexible-server create \
  --resource-group rg-aitools-prod \
  --name psql-aitools-prod \
  --sku-name Standard_D2ds_v4 \
  --tier GeneralPurpose \
  --storage-size 32 \
  --version 16 \
  --high-availability Enabled \
  --public-access none         # private endpoint only — no public internet

az postgres flexible-server db create \
  --resource-group rg-aitools-prod \
  --server-name psql-aitools-prod \
  --database-name ai_tools
```

### 2c. Azure Blob Storage

```bash
az storage account create \
  --name staitoolsprod \
  --resource-group rg-aitools-prod \
  --sku Standard_LRS \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --https-only true

az storage container create \
  --name registry-data \
  --account-name staitoolsprod \
  --auth-mode login
```

The server already has a native Azure Blob storage provider — set `STORAGE_BACKEND=azure` to activate it.

### 2d. Azure Key Vault

```bash
az keyvault create \
  --name kv-aitools-prod \
  --resource-group rg-aitools-prod \
  --enable-rbac-authorization true \   # RBAC over legacy access policies
  --soft-delete-retention-days 90

# Store secrets (never in source control or GitHub Secrets)
az keyvault secret set --vault-name kv-aitools-prod \
  --name AITOOLS-ADMIN-TOKEN \
  --value "$(openssl rand -hex 32)"

az keyvault secret set --vault-name kv-aitools-prod \
  --name DATABASE-URL \
  --value "postgresql://ai_tools:<password>@psql-aitools-prod.postgres.database.azure.com/ai_tools?sslmode=require"

az keyvault secret set --vault-name kv-aitools-prod \
  --name AZURE-STORAGE-CONNECTION-STRING \
  --value "<storage account connection string>"
```

---

## Step 3 — Configure Entra ID (OIDC Auth)

This replaces local password auth with your company's Azure identity. Users sign in with their corporate accounts.

```bash
# Register an app
az ad app create --display-name "ai-tools-registry"
# Note the appId and tenantId from the output

# Optionally restrict who can use the app (assign users/groups in Entra ID portal)
```

The server supports OIDC natively via `AUTH_BACKEND=oidc`. Set:

```bash
AUTH_BACKEND=oidc
OIDC_ISSUER=https://login.microsoftonline.com/<tenantId>/v2.0
OIDC_AUDIENCE=<appId>
```

No local user passwords are stored. Token hashes in PostgreSQL map to Entra ID identities.

---

## Step 4 — Deploy to Azure Container Apps

```bash
# Create the managed environment
az containerapp env create \
  --name env-aitools-prod \
  --resource-group rg-aitools-prod \
  --location eastus

# Deploy the container
az containerapp create \
  --name ca-aitools-registry \
  --resource-group rg-aitools-prod \
  --environment env-aitools-prod \
  --image acraitoolsprod.azurecr.io/aitools:latest \
  --registry-server acraitoolsprod.azurecr.io \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 1 --memory 2Gi \
  --ingress external --target-port 4873 \
  --secrets \
    admin-token=keyvaultref:https://kv-aitools-prod.vault.azure.net/secrets/AITOOLS-ADMIN-TOKEN,identityref:<managed-identity-id> \
    database-url=keyvaultref:https://kv-aitools-prod.vault.azure.net/secrets/DATABASE-URL,identityref:<managed-identity-id> \
    storage-conn=keyvaultref:https://kv-aitools-prod.vault.azure.net/secrets/AZURE-STORAGE-CONNECTION-STRING,identityref:<managed-identity-id> \
  --env-vars \
    AUTH_BACKEND=oidc \
    OIDC_ISSUER=https://login.microsoftonline.com/<tenantId>/v2.0 \
    OIDC_AUDIENCE=<appId> \
    STORAGE_BACKEND=azure \
    REGISTRY_ACCESS=private \
    AITOOLS_ADMIN_TOKEN=secretref:admin-token \
    DATABASE_URL=secretref:database-url \
    AZURE_STORAGE_CONNECTION_STRING=secretref:storage-conn \
    AZURE_STORAGE_CONTAINER=registry-data
```

The Container Apps managed identity pulls secrets from Key Vault at runtime. No credentials are baked into the image.

Health checks are already built into the server:
- Liveness: `GET /health`
- Readiness: `GET /health/ready`

---

## Step 5 — GitHub Actions CI/CD (No Stored Azure Credentials)

Use Workload Identity Federation so GitHub Actions authenticates to Azure via OIDC — no client secrets stored as GitHub Secrets.

### 5a. Create the federated credential

```bash
az ad app federated-credential create \
  --id <appId> \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:bitgenetics/aitools:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

Add a second credential for pull request environments if needed.

### 5b. GitHub repository variables (not secrets)

In your fork: **Settings → Secrets and variables → Actions → Variables**

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | Entra ID app ID |
| `AZURE_TENANT_ID` | Your tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID |

### 5c. Workflow file

Create `.github/workflows/deploy.yml` in your fork:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write   # required for OIDC token exchange
  contents: read

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure login (OIDC — no stored secret)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Build & push image to ACR
        run: |
          az acr build \
            --registry acraitoolsprod \
            --image aitools:${{ github.sha }} \
            --image aitools:latest \
            .

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name ca-aitools-registry \
            --resource-group rg-aitools-prod \
            --image acraitoolsprod.azurecr.io/aitools:${{ github.sha }}
```

Each push to `main` builds a new image tagged with the commit SHA and deploys atomically.

---

## Step 6 — Network Security (Private Endpoints)

Remove public internet access from the database and storage.

```bash
# Private endpoint for PostgreSQL
az network private-endpoint create \
  --name pe-postgres \
  --resource-group rg-aitools-prod \
  --vnet-name vnet-aitools \
  --subnet snet-private \
  --private-connection-resource-id $(az postgres flexible-server show \
      --name psql-aitools-prod \
      --resource-group rg-aitools-prod \
      --query id -o tsv) \
  --group-id postgresqlServer \
  --connection-name conn-postgres

# Restrict Blob Storage to VNet only
az storage account network-rule add \
  --account-name staitoolsprod \
  --vnet-name vnet-aitools \
  --subnet snet-private

az storage account update \
  --name staitoolsprod \
  --default-action Deny
```

Place **Azure Application Gateway (WAF v2 tier)** or **Azure Front Door** in front of Container Apps:
- TLS termination with an Azure-managed certificate
- OWASP Core Rule Set (WAF)
- DDoS protection
- Custom domain binding

---

## Step 7 — Production Environment Variables Reference

```bash
# Auth (Entra ID OIDC)
AUTH_BACKEND=oidc
OIDC_ISSUER=https://login.microsoftonline.com/<tenantId>/v2.0
OIDC_AUDIENCE=<appId>
AITOOLS_ADMIN_TOKEN=<from Key Vault>

# Database
DATABASE_URL=postgresql://ai_tools:<password>@psql-aitools-prod.postgres.database.azure.com/ai_tools?sslmode=require

# Storage
STORAGE_BACKEND=azure
AZURE_STORAGE_CONNECTION_STRING=<from Key Vault>
AZURE_STORAGE_CONTAINER=registry-data

# Registry
REGISTRY_ACCESS=private
PORT=4873
HOST=0.0.0.0
```

---

## Security Checklist

| Item | How it's addressed |
|---|---|
| No secrets in source control | All secrets in Azure Key Vault, referenced at runtime |
| No Azure credentials in GitHub | Workload Identity Federation (OIDC) |
| No local password storage | `AUTH_BACKEND=oidc` — Entra ID only |
| TLS on all connections | App Gateway / Front Door → Container Apps; PostgreSQL `sslmode=require`; Storage HTTPS-only |
| Registry access requires auth | `REGISTRY_ACCESS=private` |
| Non-root container process | Dockerfile already runs as uid 1001 |
| Database not on public internet | Private endpoint, `--public-access none` |
| Blob storage not public | `--allow-blob-public-access false` + VNet rule + default-action Deny |
| Secrets rotation | Key Vault versioning + rotation policies + Container Apps secret reload |
| Audit logging | Enable Azure Monitor Diagnostic Settings on all resources |
| Upstream security patches | `git merge upstream/main` on a schedule; watch upstream releases |
| Admin token uniqueness | Generated with `openssl rand -hex 32` — never reused across environments |
