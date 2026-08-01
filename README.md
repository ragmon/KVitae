# KVitae — CV Manager (Hono + Cloudflare Workers)

Serverless CV backend on Cloudflare Workers with KV (JSON data) and R2 (HTML/assets).

**Author:** [Arthur Rahimov](https://github.com/ragmon)  
**License:** [MIT](./LICENSE)

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

## CI/CD (GitHub Actions)

On every push to `main`, `.github/workflows/deploy.yml` deploys the Worker with Wrangler.

### Required repository secrets

| Secret | Value |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts Edit**, **Account Settings Read**, **Workers KV Storage Edit**, **Workers R2 Storage Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | `b21935a261bd227400d32c634a32fc20` |

Create a token: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **Edit Cloudflare Workers** template (or custom with the permissions above).

Then set secrets:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID --body "b21935a261bd227400d32c634a32fc20"
```

Manual deploy from Actions: **Actions** → **Deploy** → **Run workflow**.

## CV content

| File | Purpose |
|------|---------|
| `templates/index.html` | Sanitized HTML shell (no personal data). Renders from `window.__CV_DATA__`. |
| `cv.example.json` | Sample CV payload for KV. |
| `cv.json` | **Your private CV data** — gitignored. Copy from the example and fill in locally. |

```bash
cp cv.example.json cv.json
# edit cv.json with your real data (never commit it)
```

Upload the template and JSON to the live Worker:

```bash
curl -X PUT https://your-worker-url.workers.dev/media/index.html \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: text/html" \
  --data-binary @templates/index.html

curl -X PUT https://your-worker-url.workers.dev/api/cv \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @cv.json
```

### Sample `cv.json`

```json
{
  "name": "Jane Doe",
  "role": "Fullstack Developer · AI & Automation",
  "status": "Available for projects",
  "avatar": "/media/avatar.jpg",
  "contact": {
    "phone": "+00 0 00 00 00 00",
    "email": "you@example.com",
    "website": "https://example.com",
    "location": "City, Region, Country",
    "linkedin": "https://www.linkedin.com/in/example",
    "linkedinLabel": "in/example",
    "github": "https://github.com/example",
    "githubLabel": "github/example"
  },
  "techStack": [
    { "label": "Backend", "items": ["NestJS", "Node.js", "Laravel"] },
    { "label": "Languages", "items": ["TypeScript", "JavaScript", "Python", "SQL"] }
  ],
  "coreSkills": ["Backend & API", "AI & Automation", "Microservices"],
  "education": [
    {
      "title": "Bachelor of Computer Science",
      "detail": "Example University\nCity, Country · 2010–2014"
    }
  ],
  "languages": [
    { "name": "English", "level": "Fluent" }
  ],
  "availability": [
    { "label": "Freelance / B2B", "detail": "remote or hybrid projects" }
  ],
  "summary": "Reliable full-stack developer with a strong backend focus.",
  "experience": [
    {
      "title": "Senior Backend Developer — Example Co",
      "dates": "2023 – Present",
      "location": "Remote",
      "bullets": [
        "Designed and shipped scalable APIs.",
        "Improved reliability with automated tests."
      ]
    }
  ],
  "volunteering": "Contributes to community and open-source initiatives.",
  "references": [
    {
      "name": "Alex Smith",
      "detail": "Example Co / Engineering Manager\nin/alex-smith"
    }
  ],
  "footer": "Example Development · Reg 00000000 · City, Country"
}
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

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

Copyright © 2026 Arthur Rahimov.
