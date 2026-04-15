import { requireCfAccessJwt } from "../_lib/cfAccess.js";

export async function onRequestGet({ env, request }) {
	
  const auth = await requireCfAccessJwt(request, env);
  if (!auth.ok) {
    return new Response(auth.message, { status: auth.status });
  }

  // Optional: you can log who accessed it:
  // console.log("Admin downloads accessed by:", auth.payload?.email);

  // Optional: allow ?limit=50 override, with safety bounds
  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = clampInt(limitParam, 1, 200, 50);

  // 1) Total count of all rows
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups`)
    .first();

  const totalCount = countRow?.cnt ?? 0;

  // 2) Last N rows (FULL rows)
  const { results } = await env.DB.prepare(`
    SELECT id, name, email, updates, created_at
    FROM download_signups
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  // 3) Return data (unmasked)
  return new Response(JSON.stringify({
    total_count: totalCount,
    limit: limit,
    rows: results ?? []
  }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number.isFinite(value) ? value : parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}