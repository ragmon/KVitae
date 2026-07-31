import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import type { Context, Next } from 'hono';

// Define the shape of our Cloudflare bindings
type Bindings = {
  CV_STORAGE: KVNamespace;
  CV_BUCKET: R2Bucket;
  AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Middleware: Dynamic Bearer Auth
 * We read the token from the Cloudflare environment variable at runtime.
 */
const withAuth = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = bearerAuth({ token: c.env.AUTH_SECRET });
  return auth(c, next);
};

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

/**
 * GET /
 * Fetches HTML from R2, injects JSON from KV, and serves the page.
 */
app.get('/', async (c) => {
  let htmlStr = '';
  
  // Try to load the main template from R2
  const templateObj = await c.env.CV_BUCKET.get('index.html');
  
  if (templateObj) {
    htmlStr = await templateObj.text();
  } else {
    // Fallback template if nothing is uploaded yet
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

  // Fetch the CV data
  const cvData = await c.env.CV_STORAGE.get('cv_data') || '{}';
  
  // Inject the data securely into the window object for frontend frameworks (Vue/React)
  // or simple vanilla JS manipulation.
  const injectionScript = `<script>window.__CV_DATA__ = ${cvData};</script>`;
  
  // Replace a placeholder (or append before closing body)
  const finalHtml = htmlStr.includes('<!-- DATA_INJECTION_POINT -->') 
    ? htmlStr.replace('<!-- DATA_INJECTION_POINT -->', injectionScript)
    : htmlStr.replace('</body>', `${injectionScript}</body>`);

  return c.html(finalHtml);
});

/**
 * GET /api/cv
 * Returns raw CV JSON data from KV.
 */
app.get('/api/cv', async (c) => {
  const data = await c.env.CV_STORAGE.get('cv_data', 'json');
  return c.json(data || {});
});

/**
 * GET /media/:filename
 * Serves static assets directly from R2.
 */
app.get('/media/:filename', async (c) => {
  const filename = c.req.param('filename');
  const object = await c.env.CV_BUCKET.get(filename);

  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // Return the raw readable stream
  return new Response(object.body as ReadableStream, { headers });
});

// ==========================================
// PROTECTED ENDPOINTS (Require Bearer Token)
// ==========================================

/**
 * PUT /api/cv
 * Accepts JSON payload and updates KV store.
 */
app.put('/api/cv', withAuth, async (c) => {
  try {
    const body = await c.req.json();
    // Validate JSON structure here if needed (e.g., Zod)
    await c.env.CV_STORAGE.put('cv_data', JSON.stringify(body));
    return c.json({ success: true, message: 'CV updated successfully' });
  } catch (err) {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }
});

/**
 * PUT /media/:filename
 * Uploads a file (images, index.html) to R2 bucket.
 */
app.put('/media/:filename', withAuth, async (c) => {
  const filename = c.req.param('filename');
  
  // Stream the body directly to R2 for memory efficiency
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
    url: `/media/${filename}`
  });
});

export default app;
