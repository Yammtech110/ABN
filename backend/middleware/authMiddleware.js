/**
 * authMiddleware.js
 *
 * authenticate  — verifies Bearer JWT (app or Supabase) and attaches req.user
 * requireRole   — role-based access control guard
 *
 * Always reloads the user from app_users so blocked accounts and role changes
 * take effect immediately (JWT claims alone are not trusted for authz).
 */

const jwt = require('jsonwebtoken');
const { findByEmail, findById } = require('../lib/userStore');
const { JWT_SECRET } = require('../config/security');

let supabaseAdmin = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = require('../supabase').supabaseAdmin;
  }
} catch {
  // Supabase optional — app JWT auth still works
}

const mapDbUser = (u) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  name: u.name,
});

const rejectBlocked = (res) =>
  res.status(403).json({ error: 'Your account has been blocked. Contact support.' });

/**
 * Resolve a live app_users row and reject if missing or blocked.
 * Role always comes from the DB — never from JWT claims or client metadata.
 */
async function attachLiveUser(res, { id, email }) {
  let dbUser = null;
  if (id) {
    try {
      dbUser = await findById(id);
    } catch {
      dbUser = null;
    }
  }
  if (!dbUser && email) {
    try {
      dbUser = await findByEmail(String(email).toLowerCase().trim());
    } catch {
      dbUser = null;
    }
  }
  if (!dbUser) {
    return { error: res.status(401).json({ error: 'Invalid token. Please log in again.' }) };
  }
  if (dbUser.isBlocked) {
    return { error: rejectBlocked(res) };
  }
  return { user: mapDbUser(dbUser) };
}

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Accepts Express-issued JWTs and Supabase access tokens when configured.
 * Attaches { id, email, role, name } to req.user on success.
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Include a valid Bearer token.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const live = await attachLiveUser(res, { id: payload.id, email: payload.email });
    if (live.error) return live.error;
    req.user = live.user;
    return next();
  } catch {
    // fall through — try Supabase JWT
  }

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        throw error || new Error('Invalid Supabase token.');
      }

      const authUser = data.user;
      const email = authUser.email?.toLowerCase().trim() ?? '';
      const dbUser = email ? await findByEmail(email) : null;

      if (dbUser) {
        if (dbUser.isBlocked) return rejectBlocked(res);
        req.user = mapDbUser(dbUser);
        return next();
      }

      // First OAuth visit before oauth-sync creates app_users — customer only.
      // Never trust user_metadata / app_metadata role for authorization.
      const meta = authUser.user_metadata ?? {};
      req.user = {
        id: authUser.id,
        email,
        role: 'customer',
        name: meta.name || email.split('@')[0] || 'User',
      };
      return next();
    } catch {
      // fall through
    }
  }

  return res.status(401).json({ error: 'Invalid token. Please log in again.' });
};

/**
 * Usage: router.post('/admin-only', authenticate, requireRole('admin'), handler)
 *        router.post('/biz-route',  authenticate, requireRole('business', 'admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. This endpoint requires one of: ${roles.join(', ')}`,
    });
  }
  next();
};

module.exports = { authenticate, requireRole };
