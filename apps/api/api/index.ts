import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from '../src/app.js';

const app = buildApp();
let initialized = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!initialized) {
    await app.ready();
    initialized = true;
  }
  app.server.emit('request', req, res);
}
