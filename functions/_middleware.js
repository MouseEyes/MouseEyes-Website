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
    We only intervene when:
    - Pages returned 200
    - This is NOT the homepage
    - This is NOT a static asset
    - This path used to exist but was deleted
  */

  if (response.status === 200) {
    // Allow the homepage
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return response;
    }

    // Allow static assets (css, js, images, etc.)
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|txt|xml|json)$/)) {
      return response;
    }

    // Anything else resolving to 200 is a deleted page → gone
    return new Response("Gone", { status: 410 });
  }

  return response;
}