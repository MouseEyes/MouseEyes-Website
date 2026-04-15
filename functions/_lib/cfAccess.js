import { jwtVerify, createRemoteJWKSet } from "jose";

/**
 * Cloudflare Access JWT validation for Pages Functions.
 *
 * Token sources:
 *  - Preferred: Cf-Access-Jwt-Assertion header (Cloudflare recommends this) [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
 *  - Fallback: CF_Authorization cookie (commonly used for browser requests) [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
 *
 * Required env vars (Production/Preview in Pages settings):
 *  - CF_ACCESS_TEAM_DOMAIN = "https://mouseeyes.cloudflareaccess.com"
 *  - CF_ACCESS_AUD         = "<Application Audience (AUD) Tag>"
 *
 * Optional local dev:
 *  - DEV_BYPASS_ACCESS = "true" (bypasses verification locally) [2](https://github.com/cloudflare/cloudflare-docs/blob/production/content/pages/functions/_index.md)
 */
export async function requireCfAccessJwt(request, env) {
  // ✅ LOCAL DEV BYPASS (explicit and safe)
  // Only enable this in local development (.dev.vars), never in production. [2](https://github.com/cloudflare/cloudflare-docs/blob/production/content/pages/functions/_index.md)
  if (env?.DEV_BYPASS_ACCESS === "true") {
    return {
      ok: true,
      payload: {
        email: "local-dev@mouseeyes",
        source: "DEV_BYPASS_ACCESS",
      },
    };
  }

  // 1) Extract token (header preferred; cookie fallback for browsers) [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
  let token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers.get("cf-access-jwt-assertion");

  if (!token) {
    token = getCookie(request, "CF_Authorization");
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Missing Cloudflare Access JWT (header or CF_Authorization cookie)",
    };
  }

  // 2) Read required env vars
  const teamDomainRaw = (env?.CF_ACCESS_TEAM_DOMAIN || "").trim();
  const aud = (env?.CF_ACCESS_AUD || "").trim();

  if (!teamDomainRaw || !aud) {
    return {
      ok: false,
      status: 500,
      message:
        "Server misconfigured: CF_ACCESS_TEAM_DOMAIN and/or CF_ACCESS_AUD missing",
    };
  }

  // Normalize team domain: must be a full https URL and must match the JWT issuer format. [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
  const teamDomain = normalizeHttpsUrl(teamDomainRaw);
  if (!teamDomain) {
    return {
      ok: false,
      status: 500,
      message:
        "Server misconfigured: CF_ACCESS_TEAM_DOMAIN must be a valid https URL, e.g. https://mouseeyes.cloudflareaccess.com",
    };
  }

  // 3) Verify token signature + claims using Cloudflare's JWKS endpoint [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
  // Cloudflare advises validating with the remote certs endpoint to avoid key rotation issues. [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
  const jwksUrl = new URL(`${teamDomain}/cdn-cgi/access/certs`);
  const JWKS = createRemoteJWKSet(jwksUrl);

  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer: teamDomain,
      audience: aud,
    });

    return {
      ok: true,
      payload,
      header: protectedHeader, // useful for debugging (kid/alg)
    };
  } catch (err) {
    return {
      ok: false,
      status: 403,
      message: `Invalid Access token: ${err?.message || "verification failed"}`,
    };
  }
}

/** Extracts a cookie by name from the request headers. */
function getCookie(request, name) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  // Match cookie name at start or after '; '
  const re = new RegExp(`(?:^|;\\s*)${escapeRegExp(name)}=([^;]*)`);
  const match = cookie.match(re);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    // JWTs are base64url-ish; decodeURIComponent is usually safe,
    // but if anything odd happens, return raw value.
    return match[1];
  }
}

/** Ensure https:// prefix and remove trailing slashes. Returns null if invalid. */
function normalizeHttpsUrl(value) {
  let v = (value || "").trim();
  if (!v) return null;

  // If user supplied just "mouseeyes.cloudflareaccess.com", fix it.
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;

  // Must be https for Access issuer & certs endpoint. [1](https://onedrive.live.com/?id=422b7acb-9692-4130-8d9b-732409707080&cid=68781e8b9c054835&web=1)
  if (!/^https:\/\//i.test(v)) return null;

  // Remove trailing slashes
  v = v.replace(/\/+$/, "");

  // Validate URL format
  try {
    const u = new URL(v);
    if (!u.hostname.endsWith("cloudflareaccess.com")) {
      // Not strictly required, but helps catch misconfig.
      // Still allow it if you ever use a custom team domain format.
      // return null;
    }
    return u.origin; // ensures "https://host" no path
  } catch {
    return null;
  }
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}