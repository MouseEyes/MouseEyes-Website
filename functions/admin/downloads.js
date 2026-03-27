export async function onRequestGet({ env }) {
  const rows = await env.DB
    .prepare(`
      SELECT name, email, updates, created_at
      FROM download_signups
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .all();

  return new Response(JSON.stringify(rows.results, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
``