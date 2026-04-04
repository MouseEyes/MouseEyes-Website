export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: "DB binding missing" }, { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const before = (body?.before ?? "").toString().trim();
  const confirm = body?.confirm === true;
  const expectedCount = body?.expected_count;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    return Response.json({ error: "before must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!confirm) {
    return Response.json(
      { error: "Confirmation required. Pass { confirm: true } to execute." },
      { status: 400 }
    );
  }

  const MAX_DELETE = 500; // safety rail — adjust if you want

  // Re-count right before deleting (prevents accidental large deletes)
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM download_signups WHERE created_at < datetime(?)`)
    .bind(before)
    .first();

  const count = countRow?.cnt ?? 0;

  // Optional extra safety: require the caller to echo the preview count
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
        hint: "Narrow your criteria or raise MAX_DELETE intentionally."
      },
      { status: 400 }
    );
  }

  const result = await env.DB
    .prepare(`DELETE FROM download_signups WHERE created_at < datetime(?)`)
    .bind(before)
    .run();

  const deleted = result?.meta?.changes ?? 0;

  return Response.json(
    { ok: true, mode: "execute", criteria: { before }, matched_before_delete: count, deleted_rows: deleted },
    { headers: { "Cache-Control": "no-store" } }
  );
}