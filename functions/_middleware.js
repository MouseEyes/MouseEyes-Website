const DELETED_PAGES = new Set([
  "/pricing2",
  "/pricing2.html"
  // add more here when you delete pages
]);

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Kill explicitly deleted pages
  if (DELETED_PAGES.has(url.pathname)) {
    return new Response("Gone", { status: 410 });
  }

  // Everything else behaves normally
  return context.next();
}