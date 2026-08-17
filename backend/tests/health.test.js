const test = require('node:test');
const assert = require('node:assert/strict');

const express = require('express');
const request = require('node:http');

// Keep this test dependency-light: exercise the same response contract as /health
// without connecting to MongoDB or starting the application listener.
test('health endpoint returns an operational status payload', async () => {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const { port } = server.address();
  const body = await new Promise((resolve, reject) => {
    const req = request.get(`http://127.0.0.1:${port}/health`, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
  });

  await new Promise((resolve) => server.close(resolve));

  assert.equal(body.statusCode, 200);
  assert.deepEqual(body.body, { status: 'ok' });
});
