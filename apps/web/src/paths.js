import path from "node:path";

export function resolvePublicPath(publicDir, urlPath) {
  let pathname;
  try {
    pathname = new URL(urlPath, "http://localhost").pathname;
  } catch {
    return null;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) return null;
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const root = path.resolve(publicDir);
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  if (resolved === root) return null;
  return resolved;
}
