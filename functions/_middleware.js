export async function onRequest(context) {
  const url = new URL(context.request.url);

  // ✅ EXPLICITLY deleted pages only
  if (
    url.pathname === "/pricing2" ||
    url.pathname === "/pricing2.html"
  ) {
    return new Response("Gone", { status: 410 });
  }

  // ✅ Everything else behaves normally
  return context.next();
}