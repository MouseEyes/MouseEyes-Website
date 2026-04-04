export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: "DB binding missing" }, { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const before = (body?.before ?? "").toString().trim(); // YYYY-MM-DD
  const limit = clampInt(body?.limit, 1, 200, 50);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    return Response.json({ error: "before must be YYYY-MM-DD" }, { status: 400 });
  }

  // Count how many would be deleted
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE created_at < datetime(?)`)
    .bind(before)
    .first();

  const count = countRow?.cnt ?? 0;

  // Return a sample (most recent first) so you can verify what matches
  const { results } = await env.DB
    .prepare(`
      SELECT id, name, email, updates, created_at
      FROM download_signups
      WHERE created_at < datetime(?)
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(before, limit)
    .all();

  return Response.json(
    {
      ok: true,
      mode: "preview",
      criteria: { before },
      match_count: count,
      sample_limit: limit,
      sample_rows: results ?? [],
      next_step: {
        endpoint: "/admin/downloads/execute-delete-by-date",
        body_example: { before, confirm: true, expected_count: count }
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}