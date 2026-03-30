/**
 * Protects admin onboarding routes. Set ADMIN_API_KEY in env; send X-Admin-Key header.
 */
export function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || expected.length < 8) {
    return res.status(503).json({
      success: false,
      error: 'ADMIN_API_KEY is not configured',
    });
  }
  const provided = req.headers['x-admin-key'];
  if (typeof provided !== 'string' || provided !== expected) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}
