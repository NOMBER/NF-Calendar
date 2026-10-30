/**
 * Vault path helpers (pure). Every path built from user settings goes through
 * `sanitizeVaultPath`, so notes can only be created inside the vault.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const WINDOWS_DRIVE = /^[a-zA-Z]:/;

/** Max length of a user supplied path / format (defensive, far above real use). */
export const MAX_PATH_LENGTH = 512;

/**
 * Normalise a vault-relative path ("a/b/c.md"). A leading "/" means the vault
 * root, as in Obsidian. Returns null if the path could leave the vault or
 * touch the config folder: "..", drive letters, "~", control characters,
 * `configDir` (".obsidian") as first segment, or an over-long path.
 */
export function sanitizeVaultPath(path: string, configDir = ".obsidian"): string | null {
  if (typeof path !== "string") {
    return null;
  }
  const raw = path.trim().replace(/\\/g, "/");
  if (raw.length > MAX_PATH_LENGTH || CONTROL_CHARS.test(raw)) {
    return null;
  }
  if (WINDOWS_DRIVE.test(raw) || raw.startsWith("~")) {
    return null;
  }
  const segments = raw.split("/").filter((s) => s !== "" && s !== ".");
  // "..", and dot/space-only names that Windows may collapse into "..".
  if (segments.some((s) => /^[.\s]+$/.test(s))) {
    return null;
  }
  if (segments.length && configDir && segments[0].toLowerCase() === configDir.toLowerCase()) {
    return null;
  }
  return segments.join("/");
}

/** Is a folder / template setting acceptable? Empty means "vault root" / "none". */
export function isSafeVaultPath(path: string, configDir?: string): boolean {
  return !path || !path.trim() || sanitizeVaultPath(path, configDir) !== null;
}

/**
 * Join a folder and a file name into a safe vault path ending in ".md".
 * Returns null if the result would be unsafe (see `sanitizeVaultPath`).
 */
export function buildNotePath(folder: string, filename: string, configDir?: string): string | null {
  const name = filename.endsWith(".md") ? filename : `${filename}.md`;
  const joined = sanitizeVaultPath(`${folder || ""}/${name}`, configDir);
  if (!joined || joined === ".md" || joined.endsWith("/.md")) {
    return null;
  }
  return joined;
}

/** All parent folders of a vault path, shortest first. */
export function parentFolders(path: string): string[] {
  const parts = path.split("/");
  parts.pop();
  const result: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    result.push(parts.slice(0, i).join("/"));
  }
  return result.filter((p) => p.length > 0);
}

/** Folder normalised to "a/b" (no leading/trailing slashes); "" for vault root. */
export function cleanFolder(folder: string): string {
  return (folder || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Path of a markdown file relative to `folder`, without ".md".
 * Returns null when the file is not inside the folder.
 */
export function relativeNotePath(filePath: string, folder: string): string | null {
  if (!filePath.toLowerCase().endsWith(".md")) {
    return null;
  }
  const f = cleanFolder(folder);
  let rel = filePath;
  if (f) {
    if (!filePath.startsWith(`${f}/`)) {
      return null;
    }
    rel = filePath.slice(f.length + 1);
  }
  return rel.slice(0, -3);
}
