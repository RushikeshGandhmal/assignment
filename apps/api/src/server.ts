import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { db } from './db/index.js';
import { env } from './env.js';

// Verify the DB connection at boot so deployment failures surface immediately
// rather than on the first user request.
db.all(sql`select 1`);

const app = createApp({
  db,
  jwtSecret: env.JWT_SECRET,
  corsOrigin: env.CORS_ORIGIN,
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[api] database: ${env.DATABASE_FILE}`);
});
