import { createServer } from "http";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { seedAccounts, seedCustomDigimons, seedCharacterOverrides, activateAllSeededDigimons, deactivateLegacyEntries, syncImagesFromFolder, applyManualImageDecisions, fixDigimonRarities, deactivateDuplicateEntries, seedSpiritItems, fixBrokenEvolvesFromIds } from "./seed.js";
import { inicializadorSistema } from "./lib/systemAccounts.js";
import { initSocket } from "./lib/socket.js";

const port = Number(process.env["PORT"] || "3000");
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: ${process.env["PORT"]}`);

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, "../../..");

async function autoMigrate() {
  try {
    execSync("pnpm --filter @workspace/db push", {
      cwd: workspaceRoot, stdio: "pipe", timeout: 60000, env: process.env
    });
    console.log("Database schema ready.");
  } catch (err) {
    console.warn("Database migration warning:", String(err));
  }
}

async function runSeed() {
  try {
    await seedAccounts(); await seedCustomDigimons(); await seedCharacterOverrides();
    await syncImagesFromFolder(); await applyManualImageDecisions(); await seedSpiritItems();
    await activateAllSeededDigimons(); await deactivateLegacyEntries();
    await deactivateDuplicateEntries(); await fixBrokenEvolvesFromIds(); await fixDigimonRarities();
    try { await inicializadorSistema.garantirContasEspeciais(); }
    catch (err) { logger.warn({ err }, "Special accounts initialization skipped"); }
    logger.info("Seed completed.");
  } catch (err) { logger.error({ err }, "Seed error; server remains online"); }
}

async function main() {
  await autoMigrate();
  const httpServer = createServer(app);
  initSocket(httpServer);
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, "0.0.0.0", resolve);
    httpServer.on("error", reject);
  });
  logger.info({ port }, "OMEGA DX API online");
  runSeed().catch((err) => logger.error({ err }, "Seed fatal error"));
}
main().catch((err) => { logger.error({ err }, "Fatal startup error"); process.exit(1); });
