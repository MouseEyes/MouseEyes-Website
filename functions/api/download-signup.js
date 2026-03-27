export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body?.name ?? '').toString().trim();
  const email = (body?.email ?? '').toString().trim();
  const updates = body?.updates ? 1 : 0;

  if (!name) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }

  const userAgent = request.headers.get('User-Agent');
  const ip = request.headers.get('CF-Connecting-IP');

  try {
    await env.DB
      .prepare(
        `INSERT INTO download_signups
         (name, email, updates, user_agent, ip)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        name,
        email || null,
        updates,
        userAgent || null,
        ip || null
      )
      .run();

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: 'Database insert failed' },
      { status: 500 }
    );
  }
}