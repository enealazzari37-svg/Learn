/* KI-Verbrauch des Kontos heute (Token). Budget pro Woche: Gratis 12 500, Pro 120 000. */
const L = require("./_lib");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!L.sameOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  const user = await L.userFromReq(req); if (!user) return res.status(401).json({ error: "Nicht angemeldet" });
  if (!L.FREE_TOKENS) return res.status(200).json({ enabled: false });
  const [tier, w] = await Promise.all([L.tierOf(user.id), L.aiUsed(user.id)]), pro = tier === "pro";
  if (!w) return res.status(200).json({ enabled: false });
  res.status(200).json({ enabled: true, pro, tier, ...L.aiUsage(tier, w), hours: L.WINDOW_H, sHours: L.SESSION_H });
};
