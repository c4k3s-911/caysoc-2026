// Bearer-token RBAC for the governance API. Tokens are configured via
// CAYSOC_GOV_TOKENS, a JSON array of { token, role, name, company? }.
// Roles: board (all), operator (all writes + reads), client (read own company),
// public (summary only). No token => summary only.
function config() {
  try {
    const raw = process.env.CAYSOC_GOV_TOKENS || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function resolve(req) {
  const h = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  return config().find(t => String(t.token) === m[1]) || null;
}

export function optionalAuth(req, _res, next) {
  const t = resolve(req);
  req.gov = t
    ? { role: t.role || 'public', name: t.name || 'token', company: t.company || null }
    : { role: 'public', name: 'anonymous', company: null };
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const t = resolve(req);
    if (!t || !roles.includes(t.role)) {
      return res.status(403).json({ error: 'forbidden', required: roles });
    }
    req.gov = { role: t.role, name: t.name || 'token', company: t.company || null };
    next();
  };
}

export function visibleFinding(f, gov) {
  if (gov.role === 'client' && String(f.company || '').toLowerCase() !== String(gov.company || '').toLowerCase()) return false;
  return true;
}

export function configuredRoles() {
  return config().map(t => t.role).filter(Boolean);
}
