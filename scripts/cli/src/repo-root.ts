import { fileURLToPath } from "node:url";
import path from "node:path";

// scripts/cli/src/<this file> -> repo root is three levels up.
export const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..");
