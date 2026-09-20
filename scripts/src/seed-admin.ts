import { db, usersTable, gameSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ADMIN_USERNAME = "dede336";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? "SET_ADMIN_PASSWORD_HASH";

const ASSISTANT_USERNAME = "rimuru336";
const ASSISTANT_PASSWORD = process.env.ASSISTANT_PASSWORD ?? "SET_ASSISTANT_PASSWORD";
const ASSISTANT_ROLE = "digimon_creator";
const ASSISTANT_TAMER_LEVEL = 15;

async function seedAdmin() {
  const [existing] = await db
    .select({ id: usersTable.id, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.username, ADMIN_USERNAME))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({ isAdmin: true, role: "admin", passwordHash: ADMIN_PASSWORD_HASH })
      .where(eq(usersTable.id, existing.id));
    console.log(`Conta '${ADMIN_USERNAME}' atualizada — admin, role e senha redefinidos.`);
  } else {
    await db.insert(usersTable).values({
      username: ADMIN_USERNAME,
      passwordHash: ADMIN_PASSWORD_HASH,
      isAdmin: true,
      role: "admin",
    });
    console.log(`Conta admin '${ADMIN_USERNAME}' criada com sucesso.`);
  }
}

async function seedAssistant() {
  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.username, ASSISTANT_USERNAME))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({ role: ASSISTANT_ROLE })
      .where(eq(usersTable.id, existing.id));
    console.log(`Conta '${ASSISTANT_USERNAME}' já existe — role atualizada para ${ASSISTANT_ROLE}.`);

    const [existSave] = await db
      .select({ id: gameSavesTable.id })
      .from(gameSavesTable)
      .where(eq(gameSavesTable.userId, existing.id))
      .limit(1);

    if (!existSave) {
      await db.insert(gameSavesTable).values({
        userId: existing.id,
        saveData: { tamerLevel: ASSISTANT_TAMER_LEVEL, tamerExp: 0 },
      });
      console.log(`Save inicial criado para '${ASSISTANT_USERNAME}' no rank ${ASSISTANT_TAMER_LEVEL}.`);
    } else {
      const saveData = existSave as any;
      if (!saveData.saveData?.tamerLevel) {
        await db.update(gameSavesTable)
          .set({ saveData: { ...(saveData.saveData ?? {}), tamerLevel: ASSISTANT_TAMER_LEVEL, tamerExp: 0 } })
          .where(eq(gameSavesTable.userId, existing.id));
      }
    }
    return;
  }

  const passwordHash = await bcrypt.hash(ASSISTANT_PASSWORD, 10);
  const [user] = await db.insert(usersTable).values({
    username: ASSISTANT_USERNAME,
    passwordHash,
    isAdmin: false,
    role: ASSISTANT_ROLE,
  }).returning();

  await db.insert(gameSavesTable).values({
    userId: user.id,
    saveData: { tamerLevel: ASSISTANT_TAMER_LEVEL, tamerExp: 0 },
  });

  console.log(`Conta assistente '${ASSISTANT_USERNAME}' criada com role=${ASSISTANT_ROLE}, rank=${ASSISTANT_TAMER_LEVEL}.`);
}

async function main() {
  await seedAdmin();
  await seedAssistant();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao executar seed:", err);
  process.exit(1);
});
