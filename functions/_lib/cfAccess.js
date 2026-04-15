import { jwtVerify, createRemoteJWKSet } from "jose";

/**
 * Verifies Cloudflare Access JWT.
 * - Prefers Cf-Access-Jwt-Assertion header (recommended by Cloudflare).
 * - Validates signature via remote JWKS at https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
 * - Validates audience (AUD tag for the Access app)
 * - Validates issuer (team domain)
 */
export async function requireCfAccessJwt(request, env) {
  // ✅ LOCAL DEV BYPASS (explicit and safe)
  if (env.DEV_BYPASS_ACCESS === "true") {
    return {
      ok: true,
      payload: {
        email: "local-dev@mouseeyes",
        source: "DEV_BYPASS_ACCESS"
      }
    };
  }

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers.get("cf-access-jwt-assertion");

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Missing Cf-Access-Jwt-Assertion header",
    };
  }

  const teamDomain = (env.CF_ACCESS_TEAM_DOMAIN || "").trim();
  const aud = (env.CF_ACCESS_AUD || "").trim();

  if (!teamDomain || !aud) {
    return {
      ok: false,
      status: 500,
      message: "Server misconfigured: CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD missing",
    };
  }

  const jwksUrl = new URL(`${teamDomain.replace(/\/+$/, "")}/cdn-cgi/access/certs`);
  const JWKS = createRemoteJWKSet(jwksUrl);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: teamDomain.replace(/\/+$/, ""),
      audience: aud,
    });

    // payload typically includes email, sub, etc. (depends on IdP).
    return { ok: true, payload };
  } catch (err) {
    return {
      ok: false,
      status: 403,
      message: `Invalid Access token: ${err?.message || "verification failed"}`,
    };
  }
}