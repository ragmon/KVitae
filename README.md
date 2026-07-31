# CV Manager (Hono + Cloudflare Workers)

Serverless CV backend on Cloudflare Workers with KV (JSON data) and R2 (HTML/assets).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the KV namespace

```bash
npx wrangler kv namespace create CV_STORAGE
```

Copy the `id` from the terminal output into `wrangler.jsonc` under `kv_namespaces`.

### 3. Create the R2 bucket

```bash
npx wrangler r2 bucket create cv-assets
```

### 4. Set the authentication secret

```bash
npx wrangler secret put AUTH_SECRET
```

For local development:

```bash
cp .dev.vars.example .dev.vars
# edit AUTH_SECRET in .dev.vars
```

### 5. Deploy

```bash
npx wrangler deploy
```

Local:

```bash
npm run dev
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | Serves HTML from R2 with CV JSON injected as `window.__CV_DATA__` |
| `GET` | `/api/cv` | No | Returns CV JSON from KV |
| `PUT` | `/api/cv` | Bearer | Updates CV JSON in KV |
| `GET` | `/media/:filename` | No | Serves a file from R2 |
| `PUT` | `/media/:filename` | Bearer | Uploads a file to R2 |

## Testing (cURL)

Upload template:

```bash
curl -X PUT https://your-worker-url.workers.dev/media/index.html \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: text/html" \
  --data-binary @index.html
```

Update CV JSON:

```bash
curl -X PUT https://your-worker-url.workers.dev/api/cv \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Name", "title": "Full-Stack Developer", "skills": ["Vue.js", "NestJS", "Hono"]}'
```
