import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, gameSavesTable, usersTable, customDigimonsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

const BASE_CODEX_ORDER = [
  'agumon','agumonSaver','geoGreymon','rizeGreymon','shineGreymon','shineGreymonBurstMode',
  'veemon','exVeemon','paildramon','imperialDramonFM','imperialDramonRM','imperialDramonPM',
  'greymon','metalGreymon','warGreymon',
  'gabumon','garurumon','wereGarurumon','metalGarurumon','omegamon',
  'guilmon','growlmon','megaloGrowlmon','gallantmon','gallantmonCrimsonMode',
  'lucemon','lucemonChaosMode',
  'patamon','angemon','magnaAngemon','goldramon','seraphimon',
  'pyomon','birdramon','garudamon','phoenixmon',
  'salamon','tailmon','angewomon','magnadramon','ophanimon',
  'palmon','togemon','lillymon','rosemon','rosemonBurstMode',
  'demiDevimon','devimon','myotismon','vnonMyotismon',
  'gulusGammamon',
  'silphymon','sinduramon','valdurmon',
];

type OwnedEntry = { ownedId: string; characterId: string; level: number; exp: number };

async function buildFullCodexOrder(): Promise<string[]> {
  const custom = await db.select({ id: customDigimonsTable.id }).from(customDigimonsTable).orderBy(customDigimonsTable.name);
  const customIds = custom.map((r) => `custom_${r.id}`);
  return [...BASE_CODEX_ORDER, ...customIds];
}

async function injectAdminDigimon(saveData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const fullOrder = await buildFullCodexOrder();
  const existing = (saveData.collection ?? []) as OwnedEntry[];
  const ownedCharIds = new Set(existing.map((c) => c.characterId));
  const missing = fullOrder.filter((id) => !ownedCharIds.has(id));
  if (missing.length === 0) return saveData;
  const injected: OwnedEntry[] = missing.map((charId) => ({
    ownedId: `admin_${charId}`,
    characterId: charId,
    level: 100,
    exp: 0,
  }));
  return { ...saveData, collection: [...existing, ...injected] };
}

// GET /saves
router.get("/", requireAuth, async (req, res) => {
  const [save] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, req.auth!.userId)).limit(1);
  if (!save) {
    res.status(404).json({ error: "Nenhum save encontrado" });
    return;
  }
  const isAdmin = req.auth!.isAdmin;
  const role = req.auth!.role ?? "user";
  const isDigimonCreator = role === "digimon_creator";
  const saveData = isAdmin
    ? await injectAdminDigimon(save.saveData as Record<string, unknown>)
    : save.saveData;
  res.json({ saveData, updatedAt: save.updatedAt, isAdmin, isDede: isAdmin, role, isDigimonCreator });
});

// PUT /saves
router.put("/", requireAuth, async (req, res) => {
  const { saveData } = req.body as { saveData?: unknown };
  if (!saveData || typeof saveData !== "object") {
    res.status(400).json({ error: "saveData inválido" });
    return;
  }

  let merged = saveData as Record<string, unknown>;

  // Strip admin-injected entries (admin_ prefix) — these must never be persisted
  const rawCollection = (merged.collection ?? []) as { ownedId?: string }[];
  const cleanedCollection = rawCollection.filter((c) => !String(c.ownedId ?? '').startsWith('admin_'));
  if (cleanedCollection.length !== rawCollection.length) {
    merged = { ...merged, collection: cleanedCollection };
  }

  const [existing] = await db
    .select()
    .from(gameSavesTable)
    .where(eq(gameSavesTable.userId, req.auth!.userId))
    .limit(1);

  if (existing) {
    const dbSave = (existing.saveData ?? {}) as Record<string, unknown>;

    // Always keep the highest tamerLevel (protects seeded/admin-boosted levels)
    const dbTamerLevel = (dbSave.tamerLevel as number) ?? 0;
    const clientTamerLevel = (merged.tamerLevel as number) ?? 0;
    if (dbTamerLevel > clientTamerLevel) {
      merged = { ...merged, tamerLevel: dbTamerLevel };
    }

    // Merge messages: preserve any server-side messages the client doesn't have
    const dbMessages = (dbSave.messages ?? []) as { id: string }[];
    const incomingMessages = (merged.messages ?? []) as { id: string }[];
    const incomingIds = new Set(incomingMessages.map((m) => m.id));
    const missingFromClient = dbMessages.filter((m) => !incomingIds.has(m.id));
    if (missingFromClient.length > 0) {
      merged = { ...merged, messages: [...incomingMessages, ...missingFromClient] };
    }
  }

  if (existing) {
    await db
      .update(gameSavesTable)
      .set({ saveData: merged, updatedAt: new Date() })
      .where(eq(gameSavesTable.userId, req.auth!.userId));
  } else {
    await db
      .insert(gameSavesTable)
      .values({ userId: req.auth!.userId, saveData: merged });
  }

  res.json({ success: true });
});

// POST /saves/copy — admin-only: copy save from sourceUsername to targetUsername
router.post("/copy", requireAuth, async (req, res) => {
  if (!req.auth!.isAdmin) {
    res.status(403).json({ error: "Apenas admins podem copiar saves" });
    return;
  }
  const { sourceUsername, targetUsername } = req.body as { sourceUsername?: string; targetUsername?: string };
  if (!sourceUsername?.trim() || !targetUsername?.trim()) {
    res.status(400).json({ error: "sourceUsername e targetUsername são obrigatórios" });
    return;
  }
  const [srcUser] = await db.select().from(usersTable).where(eq(usersTable.username, sourceUsername.trim())).limit(1);
  if (!srcUser) {
    res.status(404).json({ error: `Usuário '${sourceUsername}' não encontrado` });
    return;
  }
  const [dstUser] = await db.select().from(usersTable).where(eq(usersTable.username, targetUsername.trim())).limit(1);
  if (!dstUser) {
    res.status(404).json({ error: `Usuário '${targetUsername}' não encontrado` });
    return;
  }
  const [srcSave] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, srcUser.id)).limit(1);
  if (!srcSave) {
    res.status(404).json({ error: `Nenhum save encontrado para '${sourceUsername}'` });
    return;
  }
  // Strip admin-injected entries before copying
  const rawColl = ((srcSave.saveData as Record<string, unknown>).collection ?? []) as { ownedId?: string }[];
  const cleanColl = rawColl.filter((c) => !String(c.ownedId ?? '').startsWith('admin_'));
  const cleanData = { ...(srcSave.saveData as Record<string, unknown>), collection: cleanColl };

  const [dstSave] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, dstUser.id)).limit(1);
  if (dstSave) {
    await db.update(gameSavesTable).set({ saveData: cleanData, updatedAt: new Date() }).where(eq(gameSavesTable.userId, dstUser.id));
  } else {
    await db.insert(gameSavesTable).values({ userId: dstUser.id, saveData: cleanData });
  }
  res.json({ success: true, message: `Save de '${sourceUsername}' copiado para '${targetUsername}' com sucesso!` });
});

// POST /saves/export — gera arquivo de save para download
router.post("/export", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const [save] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, user.id)).limit(1);
  if (!save) { res.status(404).json({ error: "Nenhum save encontrado" }); return; }

  const isSystemAccount = user.isAdmin || user.role === "digimon_creator";
  const rawCollection = ((save.saveData as Record<string, unknown>).collection ?? []) as { ownedId?: string }[];
  const cleanCollection = rawCollection.filter((c) => !String(c.ownedId ?? "").startsWith("admin_"));
  const cleanSaveData = { ...(save.saveData as Record<string, unknown>), collection: cleanCollection };

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    username: user.username,
    email: isSystemAccount ? null : user.email,
    isSystemAccount,
    saveData: cleanSaveData,
  };

  res.json({ exportData, filename: `${user.username}_${Date.now()}.omgsave` });
});

// POST /saves/import — restaura save a partir de arquivo + credenciais
router.post("/import", async (req, res) => {
  const { exportData, password } = req.body as { exportData?: Record<string, unknown>; password?: string };
  if (!exportData || !password) { res.status(400).json({ error: "exportData e password são obrigatórios" }); return; }

  const { username, email, isSystemAccount, saveData } = exportData as {
    username?: string; email?: string | null; isSystemAccount?: boolean; saveData?: Record<string, unknown>;
  };

  if (!username || !saveData) { res.status(400).json({ error: "Arquivo de save inválido" }); return; }

  let user;
  if (isSystemAccount) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  } else {
    if (!email) { res.status(400).json({ error: "E-mail necessário para este save" }); return; }
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user && user.username !== username) {
      res.status(403).json({ error: "Este save não pertence a este e-mail" }); return;
    }
  }

  if (!user) { res.status(404).json({ error: "Conta não encontrada. Crie uma conta com o mesmo e-mail/usuário primeiro." }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Senha incorreta" }); return; }

  const cleanColl = ((saveData.collection ?? []) as { ownedId?: string }[]).filter(
    (c) => !String(c.ownedId ?? "").startsWith("admin_")
  );
  const cleanData = { ...saveData, collection: cleanColl };

  const [existing] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, user.id)).limit(1);
  if (existing) {
    await db.update(gameSavesTable).set({ saveData: cleanData, updatedAt: new Date() }).where(eq(gameSavesTable.userId, user.id));
  } else {
    await db.insert(gameSavesTable).values({ userId: user.id, saveData: cleanData });
  }

  // Notificar admin (dede336)
  try {
    const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.username, "dede336")).limit(1);
    if (adminUser) {
      const [adminSave] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, adminUser.id)).limit(1);
      const importMsg = {
        id: `import_${user.id}_${Date.now()}`,
        title: "📥 Save Importado",
        body: `O jogador "${username}" importou um save. E-mail: ${email ?? "N/A"}. Data: ${new Date().toLocaleString("pt-BR")}`,
        createdAt: new Date().toISOString(),
        isRead: false,
        rewardClaimed: true,
        reward: null,
      };
      if (adminSave) {
        const adminData = adminSave.saveData as Record<string, unknown>;
        const adminMsgs = (adminData.messages ?? []) as object[];
        await db.update(gameSavesTable).set({
          saveData: { ...adminData, messages: [importMsg, ...adminMsgs] }, updatedAt: new Date()
        }).where(eq(gameSavesTable.userId, adminUser.id));
      } else {
        await db.insert(gameSavesTable).values({ userId: adminUser.id, saveData: { messages: [importMsg] } });
      }
    }
  } catch (_) {}

  res.json({ success: true, message: "Save importado com sucesso!" });
});

export default router;
