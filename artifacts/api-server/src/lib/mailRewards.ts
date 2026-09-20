import { db, gameSavesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ==========================================
// TIPOS INTERNOS DE CORREIO E DIGIMON
// ==========================================

interface DigimonRecompensa {
  characterId: string;
  level?: number;
}

interface MensagemCorreio {
  id: string;
  title: string;
  body: string;
  rewardClaimed: boolean;
  isRead: boolean;
  createdAt: number;
  reward?: {
    bits?: number;
    items?: string[];
    digimon?: string[];
    digimonWithLevel?: DigimonRecompensa[];
  };
}

interface SaveData {
  messages?: MensagemCorreio[];
  collection?: { ownedId: string; characterId: string; level: number; exp: number }[];
  bits?: number;
  inventory?: string[];
  [key: string]: unknown;
}

// ==========================================
// FUNÇÃO 1: RESGATAR RECOMPENSA DO CORREIO (GERAL)
// ==========================================

/**
 * Executa o resgate seguro da recompensa enviada pelo Admin
 * Suporta bits, itens e Digimons como recompensa
 */
export async function resgatarRecompensaCorreio(
  userId: number,
  mensagemId: string
): Promise<string> {
  const [save] = await db
    .select()
    .from(gameSavesTable)
    .where(eq(gameSavesTable.userId, userId))
    .limit(1);

  if (!save) {
    throw new Error("Save do jogador não encontrado.");
  }

  const saveData = (save.saveData ?? {}) as SaveData;
  const messages: MensagemCorreio[] = saveData.messages ?? [];

  const mensagemIndex = messages.findIndex((m) => m.id === mensagemId);
  if (mensagemIndex === -1) {
    return "Mensagem ou recompensa não encontrada no seu correio.";
  }

  const mensagem = messages[mensagemIndex];

  if (mensagem.rewardClaimed) {
    return "Você já resgatou a recompensa desta mensagem!";
  }

  const reward = mensagem.reward;
  let newBits = saveData.bits ?? 0;
  let newInventory = [...(saveData.inventory ?? [])];
  let newCollection = [...(saveData.collection ?? [])];

  if (reward?.bits) {
    newBits += reward.bits;
  }

  if (reward?.items) {
    for (const itemId of reward.items) {
      if (!newInventory.includes(itemId)) newInventory.push(itemId);
    }
  }

  if (reward?.digimon) {
    const base = Date.now();
    reward.digimon.forEach((characterId, i) => {
      if (newCollection.length < 1000) {
        newCollection.push({
          ownedId: `owned_${characterId}_${base}_${i}`,
          characterId,
          level: 1,
          exp: 0,
        });
      }
    });
  }

  if (reward?.digimonWithLevel) {
    const base = Date.now();
    reward.digimonWithLevel.forEach(({ characterId, level = 1 }, i) => {
      if (newCollection.length < 1000) {
        newCollection.push({
          ownedId: `owned_${characterId}_${base}_${i}`,
          characterId,
          level,
          exp: 0,
        });
      }
    });
  }

  messages[mensagemIndex] = { ...mensagem, rewardClaimed: true, isRead: true };

  const updatedSave: SaveData = {
    ...saveData,
    bits: newBits,
    inventory: newInventory,
    collection: newCollection,
    messages,
  };

  await db
    .update(gameSavesTable)
    .set({ saveData: updatedSave, updatedAt: new Date() })
    .where(eq(gameSavesTable.userId, userId));

  return `Sucesso! Recompensa da mensagem resgatada com segurança.`;
}

// ==========================================
// FUNÇÃO 2: RESGATAR DIGIMON DO CORREIO (ESPECÍFICO)
// ==========================================

/**
 * Resgate seguro de Digimon enviado pelo Admin via correio
 * Previne duplicidade e garante persistência no banco de dados
 */
export async function resgatarDigimonDoCorreio(
  userId: number,
  mensagemId: string
): Promise<string> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("Jogador não encontrado no sistema.");
  }

  const [save] = await db
    .select()
    .from(gameSavesTable)
    .where(eq(gameSavesTable.userId, userId))
    .limit(1);

  if (!save) {
    throw new Error("Save do jogador não encontrado.");
  }

  const saveData = (save.saveData ?? {}) as SaveData;
  const messages: MensagemCorreio[] = saveData.messages ?? [];

  const mensagemIndex = messages.findIndex((m) => m.id === mensagemId);
  if (mensagemIndex === -1) {
    return "❌ Erro: Essa mensagem não existe ou já foi apagada.";
  }

  const mensagem = messages[mensagemIndex];

  if (mensagem.rewardClaimed) {
    return "⚠️ Você já resgatou o prêmio desta mensagem!";
  }

  const digimonIds = mensagem.reward?.digimon;
  const digimonWithLevel = mensagem.reward?.digimonWithLevel;

  const temDigimon =
    (digimonIds && digimonIds.length > 0) ||
    (digimonWithLevel && digimonWithLevel.length > 0);

  if (!temDigimon) {
    return "❌ Erro: Não há nenhum Digimon válido anexado a esta mensagem.";
  }

  let newCollection = [...(saveData.collection ?? [])];
  const base = Date.now();

  if (digimonIds) {
    digimonIds.forEach((characterId, i) => {
      if (newCollection.length < 1000) {
        newCollection.push({
          ownedId: `owned_${characterId}_${base}_${i}`,
          characterId,
          level: 1,
          exp: 0,
        });
      }
    });
  }

  if (digimonWithLevel) {
    digimonWithLevel.forEach(({ characterId, level = 1 }, i) => {
      if (newCollection.length < 1000) {
        newCollection.push({
          ownedId: `owned_${characterId}_${base}_digi_${i}`,
          characterId,
          level,
          exp: 0,
        });
      }
    });
  }

  messages[mensagemIndex] = { ...mensagem, rewardClaimed: true, isRead: true };

  const updatedSave: SaveData = {
    ...saveData,
    collection: newCollection,
    messages,
  };

  await db
    .update(gameSavesTable)
    .set({ saveData: updatedSave, updatedAt: new Date() })
    .where(eq(gameSavesTable.userId, userId));

  const nomes = [
    ...(digimonIds ?? []),
    ...(digimonWithLevel?.map((d) => d.characterId) ?? []),
  ].join(", ");

  return `🎉 Sucesso! Seu(s) Digimon (${nomes}) foram movidos com segurança para o seu DigiBank!`;
}
