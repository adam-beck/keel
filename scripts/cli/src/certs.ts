import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { repoRoot } from "./repo-root.ts";

function mkcertAvailable(): boolean {
  return spawnSync("mkcert", ["-CAROOT"]).error === undefined;
}

function readHostname(): string {
  const caddyfile = readFileSync(path.join(repoRoot, "Caddyfile"), "utf-8");
  const match = caddyfile.match(/^(\S+)\s*\{/m);
  if (!match) {
    throw new Error(
      "Couldn't find a hostname in Caddyfile (expected a line like `example.localhost {`).",
    );
  }
  return match[1];
}

export async function runCerts() {
  clack.intro(pc.bold("keel certs"));

  if (!mkcertAvailable()) {
    clack.log.error("mkcert is not installed or not on PATH.");
    clack.outro(
      `Install it first: ${pc.cyan("https://github.com/FiloSottile/mkcert#installation")}`,
    );
    process.exitCode = 1;
    return;
  }

  const hostname = readHostname();

  const caroot = execFileSync("mkcert", ["-CAROOT"], { encoding: "utf-8" }).trim();
  const caInstalled =
    existsSync(path.join(caroot, "rootCA.pem")) && existsSync(path.join(caroot, "rootCA-key.pem"));

  const spinner = clack.spinner();
  if (caInstalled) {
    clack.log.info("mkcert CA already installed, skipping.");
  } else {
    spinner.start("Installing mkcert CA");
    execFileSync("mkcert", ["-install"]);
    spinner.stop("Installed mkcert CA");
  }

  mkdirSync(path.join(repoRoot, "certs"), { recursive: true });

  spinner.start(`Generating certificate for ${hostname}`);
  execFileSync("mkcert", [
    "-cert-file",
    path.join(repoRoot, "certs", `${hostname}.pem`),
    "-key-file",
    path.join(repoRoot, "certs", `${hostname}-key.pem`),
    hostname,
  ]);
  spinner.stop("Generated certificate");

  clack.outro(
    `Certs written to ${pc.dim("./certs")}. Run ${pc.cyan("docker compose up")} and visit ${pc.cyan(`https://${hostname}`)}`,
  );
}
