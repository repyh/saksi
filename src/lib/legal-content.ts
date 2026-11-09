import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export type LegalDocSlug = "terms" | "privacy";

export function getLegalDoc(slug: LegalDocSlug): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "content", "legal", `${slug}.md`);
  return fs.readFile(filePath, "utf8");
}
