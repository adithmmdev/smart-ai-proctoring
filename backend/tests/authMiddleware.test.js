const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { protect, adminOnly } = require('../middleware/authMiddleware');

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('adminOnly rejects non-admin users', () => {
  const req = { user: { role: 'student' } };
  const res = responseMock();
  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Admin access required');
  assert.equal(nextCalled, false);
});

test('adminOnly allows admin users', () => {
  const req = { user: { role: 'admin' } };
  const res = responseMock();
  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test('protect rejects requests without a bearer token', async () => {
  const req = { headers: {} };
  const res = responseMock();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Not authorized, no token');
  assert.equal(nextCalled, false);
});

test('protect rejects invalid JWTs before database lookup', async () => {
  const req = {
    headers: { authorization: 'Bearer invalid-token' },
  };
  const res = responseMock();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Not authorized, token failed');
  assert.equal(nextCalled, false);
});

test('JWTs created with the configured secret can be verified', () => {
  const secret = 'test-secret';
  const token = jwt.sign({ id: 'test-user-id' }, secret, { expiresIn: '30d' });
  const decoded = jwt.verify(token, secret);

  assert.equal(decoded.id, 'test-user-id');
});
