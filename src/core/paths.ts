/** Join a folder and a file name into a vault path ending in `.md`. */
export function buildNotePath(folder: string, filename: string): string {
  const name = filename.endsWith(".md") ? filename : `${filename}.md`;
  const cleanFolder = (folder || "").trim().replace(/^\/+|\/+$/g, "");
  const joined = cleanFolder ? `${cleanFolder}/${name}` : name;
  return joined.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\//, "");
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
