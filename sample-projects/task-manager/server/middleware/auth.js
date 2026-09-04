const { verifyToken } = require('../auth');

// BUG 2: expects header exactly 'Authorization' with capital A, but many clients / tests send lower case 'authorization'
// Also expects token without Bearer handling inconsistency — some tests send "Bearer <token>", some send raw token.
// Current implementation only handles raw token from capital header, so Bearer prefix and lower-case header both fail.

function authMiddleware(req, res, next) {
  const token = req.headers['Authorization']; // BUG: case-sensitive, should be case-insensitive and handle Bearer
  if (!token) return res.status(401).json({ error: 'No token' });
  // BUG: does not strip Bearer prefix
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }
}

module.exports = authMiddleware;
