import http from 'node:http';
import { env } from './config/env';

// Phase 0: verify the empty TS project boots and env loads correctly.
console.log(`🚀 Backend booting in ${env.NODE_ENV} mode on port ${env.PORT}`);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(env.PORT, () => {
  console.log(`✅ Listening on http://localhost:${env.PORT}`);
});