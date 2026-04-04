export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: "DB binding missing" }, { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const prefix = (body?.prefix ?? "").toString().trim();
  const limit = clampInt(body?.limit, 1, 200, 50);

  if (!prefix) {
    return Response.json({ error: "prefix is required (example: 'Pat')" }, { status: 400 });
  }
  // Safety: don’t allow super-short prefix deletes like "" or "P" unless you want to.
  if (prefix.length < 2) {
    return Response.json({ error: "prefix must be at least 2 characters" }, { status: 400 });
  }

  const like = prefix + "%";

  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE name LIKE ?`)
    .bind(like)
    .first();

  const count = countRow?.cnt ?? 0;

  const { results } = await env.DB
    .prepare(`
      SELECT id, name, email, updates, created_at
      FROM download_signups
      WHERE name LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(like, limit)
    .all();

  return Response.json(
    {
      ok: true,
      mode: "preview",
      criteria: { prefix },
      match_count: count,
      sample_limit: limit,
      sample_rows: results ?? [],
      next_step: {
        endpoint: "/admin/downloads/execute-delete-by-name-prefix",
        body_example: { prefix, confirm: true, expected_count: count }
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