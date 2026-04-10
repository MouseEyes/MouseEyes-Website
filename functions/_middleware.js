export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Allow API and admin routes untouched
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/")
  ) {
    return next();
  }

  const response = await next();

  /*
    CASES:
    - Never-existed page → already returns 404 (leave it)
    - Existing page → returns 200 (leave it)
    - Deleted page → returns 200 BUT SHOULD NOT
  */

  if (response.status === 200) {
    // If the path ends with .html but the file no longer exists,
    // this is a deleted static page — return 410 Gone
    if (url.pathname.endsWith(".html")) {
      return new Response("Gone", { status: 410 });
    }
  }

  return response;
}