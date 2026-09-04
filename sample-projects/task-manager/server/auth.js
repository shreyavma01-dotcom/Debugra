const jwt = require('jsonwebtoken');

// BUG 1: signing uses 'mysecret' but verification below uses 'supersecret' — will cause invalid signature
const SIGN_SECRET = 'mysecret';
const VERIFY_SECRET = 'supersecret';

function generateToken(payload) {
  return jwt.sign(payload, SIGN_SECRET, { expiresIn: '1h' });
}

function verifyToken(token) {
  return jwt.verify(token, VERIFY_SECRET);
}

module.exports = { generateToken, verifyToken, SIGN_SECRET, VERIFY_SECRET };
