import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { repoRoot } from "./repo-root.ts";

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

interface Replacement {
  file: string;
  pattern: RegExp;
  replacement: string;
}

// Each entry is both the guard check (is this file still templated?) and the
// edit to apply. Keeping them paired avoids the two drifting apart — a
// pattern that's part of the rename but missing from the guard silently
// breaks the "already customized?" detection.
function replacements(name: string, dbName: string, dbUser: string): Replacement[] {
  return [
    { file: "README.md", pattern: /^# keel$/m, replacement: `# ${name}` },
    { file: "mprocs.yaml", pattern: /keel\.localhost/g, replacement: `${name}.localhost` },
    { file: "Caddyfile", pattern: /keel\.localhost/g, replacement: `${name}.localhost` },
    {
      file: "compose.yml",
      pattern: /POSTGRES_USER: keel_admin/,
      replacement: `POSTGRES_USER: ${dbUser}`,
    },
    { file: "compose.yml", pattern: /POSTGRES_DB: keel$/m, replacement: `POSTGRES_DB: ${dbName}` },
    {
      file: "compose.yml",
      pattern: /pg_isready -U keel_admin -d keel/,
      replacement: `pg_isready -U ${dbUser} -d ${dbName}`,
    },
    { file: "compose.yml", pattern: /PGUSER: keel_admin/, replacement: `PGUSER: ${dbUser}` },
    { file: "compose.yml", pattern: /PGDATABASE: keel$/m, replacement: `PGDATABASE: ${dbName}` },
    {
      file: "apps/backend/src/db.ts",
      pattern: /PGUSER \?\? "keel_admin"/,
      replacement: `PGUSER ?? "${dbUser}"`,
    },
    {
      file: "apps/backend/src/db.ts",
      pattern: /PGDATABASE \?\? "keel"/,
      replacement: `PGDATABASE ?? "${dbName}"`,
    },
    {
      file: "apps/backend/drizzle.config.ts",
      pattern: /PGUSER \?\? "keel_admin"/,
      replacement: `PGUSER ?? "${dbUser}"`,
    },
    {
      file: "apps/backend/drizzle.config.ts",
      pattern: /PGDATABASE \?\? "keel"/,
      replacement: `PGDATABASE ?? "${dbName}"`,
    },
  ];
}

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
  const dbName = name.replace(/-/g, "_");
  const dbUser = `${dbName}_admin`;
  const edits = replacements(name, dbName, dbUser);

  const stillTemplated = edits.some(({ file, pattern }) =>
    pattern.test(readIfExists(path.join(repoRoot, file))),
  );
  if (!stillTemplated) {
    clack.outro(
      "Nothing to do: this repo doesn't look like an uncustomized keel template anymore.",
    );
    return;
  }

  const spinner = clack.spinner();
  spinner.start("Renaming project files");

  for (const { file, pattern, replacement } of edits) {
    replaceInFile(path.join(repoRoot, file), pattern, replacement);
  }

  spinner.stop("Renamed project files");

  clack.outro(
    `Done. Renamed to ${pc.green(name)} (db ${pc.dim(dbName)}, db user ${pc.dim(dbUser)}).\n\n` +
      `Next steps:\n  ${pc.cyan("./scripts/cli/bin/keel certs")}\n  ${pc.cyan("docker compose up")}`,
  );
}
