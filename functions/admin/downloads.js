export async function onRequestGet({ env }) {
  // Query recent rows (adjust LIMIT if you want)
  const { results } = await env.DB.prepare(`
    SELECT name, email, updates, created_at
    FROM download_signups
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  const masked = (results || []).map((row) => ({
    name: maskName(row.name),
    email: maskEmail(row.email),               // preferred: Pat***@hot***
    // email: maskEmailKeepTld(row.email),     // alternate: Pat***@hot***.com
    updates: row.updates,
    created_at: row.created_at,
  }));


	return new Response(JSON.stringify(masked, null, 2), {
	  headers: {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store"
	  }
	});

}

/**
 * Name masking:
 * - first 3 characters + "***"
 * - output like "Pat***"
 */
function maskName(name) {
  const s = (name ?? "").toString().trim();
  if (!s) return "***";
  return s.slice(0, 3) + "***";
}

/**
 * Email masking (preferred):
 * "Pat***@hot***"
 * - first 3 of local part + "***"
 * - first 3 of the domain label (before first dot) + "***"
 */
function maskEmail(email) {
  const s = (email ?? "").toString().trim();
  if (!s) return "***";

  const at = s.indexOf("@");
  if (at === -1) {
    // Not a normal email format, fall back to first 3 + ***
    return s.slice(0, 3) + "***";
  }

  const local = s.slice(0, at);
  const domainAll = s.slice(at + 1);

  // domainLabel = part before first dot (e.g., "hotmail" from "hotmail.com")
  const dot = domainAll.indexOf(".");
  const domainLabel = dot === -1 ? domainAll : domainAll.slice(0, dot);

  return local.slice(0, 3) + "***" + "@" + domainLabel.slice(0, 3) + "***";
}

/**
 * Alternate email masking (if you want to keep ".com" visible):
 * "Pat***@hot***.com"
 */
function maskEmailKeepTld(email) {
  const s = (email ?? "").toString().trim();
  if (!s) return "***";

  const at = s.indexOf("@");
  if (at === -1) return s.slice(0, 3) + "***";

  const local = s.slice(0, at);
  const domainAll = s.slice(at + 1);

  const dot = domainAll.indexOf(".");
  if (dot === -1) {
    return local.slice(0, 3) + "***" + "@" + domainAll.slice(0, 3) + "***";
  }

  const domainLabel = domainAll.slice(0, dot);
  const tld = domainAll.slice(dot); // includes the dot

  return local.slice(0, 3) + "***" + "@" + domainLabel.slice(0, 3) + "***" + tld;
}