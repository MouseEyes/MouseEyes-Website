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

  const confirm = body?.confirm === true;
  if (!confirm) {
    return Response.json(
      { error: "Confirmation required. Pass { confirm: true } to execute." },
      { status: 400 }
    );
  }

  const ids = normalizeIds(body?.ids);
  if (ids.length === 0) {
    return Response.json({ error: "No valid ids provided" }, { status: 400 });
  }

  const MAX_DELETE = 200;
  if (ids.length > MAX_DELETE) {
    return Response.json(
      { error: `Too many ids (max ${MAX_DELETE} per request)` },
      { status: 400 }
    );
  }

  const placeholders = ids.map(() => "?").join(",");

  // Re-count right before delete (prevents surprises)
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE id IN (${placeholders})`)
    .bind(...ids)
    .first();

  const matchCount = countRow?.cnt ?? 0;

  // Optional safety: expected_count must match
  if (body?.expected_count !== undefined) {
    const expected = Number(body.expected_count);
    if (!Number.isFinite(expected) || expected !== matchCount) {
      return Response.json(
        { error: "expected_count mismatch", expected_count: expected, actual_count: matchCount },
        { status: 409 }
      );
    }
  }

  const result = await env.DB
    .prepare(`DELETE FROM download_signups WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  const deleted = result?.meta?.changes ?? 0;

  return new Response(
    JSON.stringify(
      {
        ok: true,
        mode: "execute",
        requested_ids: ids,
        matched_before_delete: matchCount,
        deleted_rows: deleted
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