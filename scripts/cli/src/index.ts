import pc from "picocolors";
import { runCerts } from "./certs.ts";
import { runInit } from "./init.ts";

const USAGE = `${pc.bold("keel")} — set up a fresh clone of this template

${pc.dim("Usage:")}
  keel init [name]  rename the project (hostname, database, DB user)
  keel certs        generate a locally-trusted TLS cert for local dev
  keel --help       show this message`;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "init":
      await runInit(args[0]);
      break;
    case "certs":
      await runCerts();
      break;
    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(pc.red(`Unknown command: ${command}`));
      console.log(USAGE);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
