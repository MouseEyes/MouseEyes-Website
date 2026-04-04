export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "DB binding missing" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = normalizeIds(body?.ids);
  if (ids.length === 0) {
    return Response.json({ error: "No valid ids provided" }, { status: 400 });
  }

  if (ids.length > 200) {
    return Response.json({ error: "Too many ids (max 200 per request)" }, { status: 400 });
  }

  const placeholders = ids.map(() => "?").join(",");

  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE id IN (${placeholders})`)
    .bind(...ids)
    .first();

  const matchCount = countRow?.cnt ?? 0;

  const { results } = await env.DB
    .prepare(`
      SELECT id, name, email, updates, created_at
      FROM download_signups
      WHERE id IN (${placeholders})
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .bind(...ids)
    .all();

  return new Response(
    JSON.stringify(
      {
        ok: true,
        mode: "preview",
        match_count: matchCount,
        sample_rows: results ?? [],
        next_step: {
          endpoint: "/admin/downloads/execute-delete-by-ids",
          body_example: { ids, confirm: true, expected_count: matchCount }
        }
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function normalizeIds(input) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();

  for (const v of arr) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}