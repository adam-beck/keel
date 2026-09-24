import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { repoRoot } from "./repo-root.ts";

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

// Files that still reference the template's original "keel" name — if none
// of these do, the repo has already been customized and there's nothing
// left to rename.
const GUARD_FILES = [
  "README.md",
  "compose.yml",
  "Caddyfile",
  "mprocs.yaml",
  "apps/backend/src/db.ts",
  "apps/backend/drizzle.config.ts",
];

function readIfExists(file: string): string {
  try {
    return readFileSync(file, "utf-8");
  } catch {
    return "";
  }
}

function replaceInFile(file: string, pattern: RegExp, replacement: string) {
  const contents = readFileSync(file, "utf-8");
  writeFileSync(file, contents.replace(pattern, replacement));
}

function ensurePassword() {
  mkdirSync(path.join(repoRoot, "secrets"), { recursive: true });
  const passwordFile = path.join(repoRoot, "secrets/postgres_password.txt");
  if (existsSync(passwordFile)) return;

  const password = randomBytes(24).toString("hex");
  writeFileSync(passwordFile, `${password}\n`);
  clack.log.success(`Generated ${pc.dim("secrets/postgres_password.txt")}`);
}

async function promptName(nameArg: string | undefined): Promise<string> {
  if (nameArg) {
    if (!NAME_PATTERN.test(nameArg)) {
      clack.log.error(
        "Name must start with a letter and contain only lowercase letters, digits, and hyphens.",
      );
      process.exit(1);
    }
    return nameArg;
  }

  const name = await clack.text({
    message: "Project name (lowercase letters, digits, hyphens)",
    validate: (value) => {
      if (!NAME_PATTERN.test(value ?? "")) {
        return "Must start with a letter and contain only lowercase letters, digits, and hyphens.";
      }
    },
  });

  if (clack.isCancel(name)) {
    clack.cancel("Cancelled.");
    process.exit(1);
  }

  return name;
}

export async function runInit(nameArg: string | undefined) {
  clack.intro(pc.bold("keel init"));

  ensurePassword();

  const name = await promptName(nameArg);

  const stillTemplated = GUARD_FILES.some((file) =>
    readIfExists(path.join(repoRoot, file)).includes("keel"),
  );
  if (!stillTemplated) {
    clack.outro(
      "Nothing to do: this repo doesn't look like an uncustomized keel template anymore.",
    );
    return;
  }

  const dbName = name.replace(/-/g, "_");
  const dbUser = `${dbName}_admin`;

  const spinner = clack.spinner();
  spinner.start("Renaming project files");

  replaceInFile(path.join(repoRoot, "README.md"), /^# keel$/m, `# ${name}`);
  replaceInFile(path.join(repoRoot, "mprocs.yaml"), /keel\.localhost/g, `${name}.localhost`);
  replaceInFile(path.join(repoRoot, "Caddyfile"), /keel\.localhost/g, `${name}.localhost`);
  replaceInFile(
    path.join(repoRoot, "compose.yml"),
    /POSTGRES_USER: keel_admin/,
    `POSTGRES_USER: ${dbUser}`,
  );
  replaceInFile(
    path.join(repoRoot, "compose.yml"),
    /POSTGRES_DB: keel$/m,
    `POSTGRES_DB: ${dbName}`,
  );
  replaceInFile(
    path.join(repoRoot, "apps/backend/src/db.ts"),
    /PGUSER \?\? "keel_admin"/,
    `PGUSER ?? "${dbUser}"`,
  );
  replaceInFile(
    path.join(repoRoot, "apps/backend/src/db.ts"),
    /PGDATABASE \?\? "keel"/,
    `PGDATABASE ?? "${dbName}"`,
  );
  replaceInFile(
    path.join(repoRoot, "apps/backend/drizzle.config.ts"),
    /PGUSER \?\? "keel_admin"/,
    `PGUSER ?? "${dbUser}"`,
  );
  replaceInFile(
    path.join(repoRoot, "apps/backend/drizzle.config.ts"),
    /PGDATABASE \?\? "keel"/,
    `PGDATABASE ?? "${dbName}"`,
  );

  spinner.stop("Renamed project files");

  clack.outro(
    `Done. Renamed to ${pc.green(name)} (db ${pc.dim(dbName)}, db user ${pc.dim(dbUser)}).\n\n` +
      `Next steps:\n  ${pc.cyan("./scripts/cli/bin/keel certs")}\n  ${pc.cyan("docker compose up")}`,
  );
}
