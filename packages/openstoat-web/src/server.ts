/**
 * HTTP server compatible with both Node.js and Bun.
 * Uses Node's http module for maximum compatibility (npm install -g, npx, etc.).
 */

import http from 'http';
import { handleRequest } from './routes';

export interface ServerOptions {
  port?: number;
}

const DEFAULT_PORT = 3947;

export function startServer(options: ServerOptions = {}): void {
  const port = options.port ?? (parseInt(process.env.OPENSTOAT_WEB_PORT ?? '', 10) || DEFAULT_PORT);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/' && url.pathname !== '') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const response = handleRequest(url);
    const headers = Object.fromEntries(response.headers.entries());
    res.writeHead(response.status, headers);
    const body = response.body ? await response.text() : '';
    res.end(body);
  });

  server.listen(port, () => {
    console.log(`OpenStoat Web UI: http://localhost:${port}`);
  });
}
