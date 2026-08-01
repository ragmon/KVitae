import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import type { Context, Next } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type Bindings = {
  CV_STORAGE: KVNamespace;
  CV_BUCKET: R2Bucket;
  AUTH_SECRET: string;
  /** Cloudflare Access application audience (AUD) tag */
  POLICY_AUD?: string;
  /** e.g. https://your-team.cloudflareaccess.com */
  TEAM_DOMAIN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeamDomain: string | null = null;

function getJwks(teamDomain: string) {
  if (!jwks || jwksTeamDomain !== teamDomain) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksTeamDomain = teamDomain;
  }
  return jwks;
}

/**
 * When POLICY_AUD + TEAM_DOMAIN are set, require a valid Cloudflare Access JWT.
 * Edge Access should already gate traffic; this is defense in depth.
 */
const withAccessJwt = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const audience = c.env.POLICY_AUD;
  const teamDomain = c.env.TEAM_DOMAIN?.replace(/\/$/, '');

  if (!audience || !teamDomain) {
    return next();
  }

  const token = c.req.header('cf-access-jwt-assertion');
  if (!token) {
    return c.text('Missing Cloudflare Access JWT', 403);
  }

  try {
    await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience,
    });
    return next();
  } catch {
    return c.text('Invalid Cloudflare Access JWT', 403);
  }
};

app.use('*', withAccessJwt);

const withAuth = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = bearerAuth({ token: c.env.AUTH_SECRET });
  return auth(c, next);
};

app.get('/', async (c) => {
  let htmlStr = '';

  const templateObj = await c.env.CV_BUCKET.get('index.html');

  if (templateObj) {
    htmlStr = await templateObj.text();
  } else {
    htmlStr = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My CV</title>
      </head>
      <body>
          <h1>Resume Server Running</h1>
          <p>Please upload an index.html to your R2 bucket.</p>
          <!-- DATA_INJECTION_POINT -->
      </body>
      </html>
    `;
  }

  const cvData = (await c.env.CV_STORAGE.get('cv_data')) || '{}';
  const injectionScript = `<script>window.__CV_DATA__ = ${cvData};</script>`;
  const finalHtml = htmlStr.includes('<!-- DATA_INJECTION_POINT -->')
    ? htmlStr.replace('<!-- DATA_INJECTION_POINT -->', injectionScript)
    : htmlStr.replace('</body>', `${injectionScript}</body>`);

  return c.html(finalHtml);
});

app.get('/api/cv', async (c) => {
  const data = await c.env.CV_STORAGE.get('cv_data', 'json');
  return c.json(data || {});
});

app.get('/media/:filename', async (c) => {
  const filename = c.req.param('filename');
  const object = await c.env.CV_BUCKET.get(filename);

  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body as ReadableStream, { headers });
});

app.put('/api/cv', withAuth, async (c) => {
  try {
    const body = await c.req.json();
    await c.env.CV_STORAGE.put('cv_data', JSON.stringify(body));
    return c.json({ success: true, message: 'CV updated successfully' });
  } catch {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }
});

app.put('/media/:filename', withAuth, async (c) => {
  const filename = c.req.param('filename');
  const bodyStream = c.req.raw.body;

  if (!bodyStream) {
    return c.json({ success: false, error: 'Empty body' }, 400);
  }

  const contentType = c.req.header('content-type') || 'application/octet-stream';

  await c.env.CV_BUCKET.put(filename, bodyStream, {
    httpMetadata: { contentType },
  });

  return c.json({
    success: true,
    message: `File ${filename} uploaded successfully`,
    url: `/media/${filename}`,
  });
});

export default app;
