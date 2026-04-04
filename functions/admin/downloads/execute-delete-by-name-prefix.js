export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: "DB binding missing" }, { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const prefix = (body?.prefix ?? "").toString().trim();
  const confirm = body?.confirm === true;
  const expectedCount = body?.expected_count;

  if (!prefix) {
    return Response.json({ error: "prefix is required (example: 'Pat')" }, { status: 400 });
  }
  if (prefix.length < 2) {
    return Response.json({ error: "prefix must be at least 2 characters" }, { status: 400 });
  }
  if (!confirm) {
    return Response.json(
      { error: "Confirmation required. Pass { confirm: true } to execute." },
      { status: 400 }
    );
  }

  const MAX_DELETE = 200; // generally tighter for name-based deletes
  const like = prefix + "%";

  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE name LIKE ?`)
    .bind(like)
    .first();

  const count = countRow?.cnt ?? 0;

  if (expectedCount !== undefined && Number(expectedCount) !== Number(count)) {
    return Response.json(
      { error: "expected_count mismatch", expected_count: Number(expectedCount), actual_count: count },
      { status: 409 }
    );
  }

  if (count > MAX_DELETE) {
    return Response.json(
      {
        error: "Delete limit exceeded",
        limit: MAX_DELETE,
        actual_count: count,
        hint: "Narrow prefix or raise MAX_DELETE intentionally."
      },
      { status: 400 }
    );
  }

  const result = await env.DB
    .prepare(`DELETE FROM download_signups WHERE name LIKE ?`)
    .bind(like)
    .run();

  const deleted = result?.meta?.changes ?? 0;

  return Response.json(
    { ok: true, mode: "execute", criteria: { prefix }, matched_before_delete: count, deleted_rows: deleted },
    { headers: { "Cache-Control": "no-store" } }
  );
}