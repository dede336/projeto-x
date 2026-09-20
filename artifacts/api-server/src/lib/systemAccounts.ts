import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ==========================================
// 1. INTERFACES DE CONTROLE DE ACESSO
// ==========================================

export type CargoUsuario = "ADMIN" | "ASSISTENTE" | "JOGADOR";

export interface ContaEspecial {
  username: string;
  senhaHash: string;
  cargo: CargoUsuario;
  permissoes: string[];
  isAdmin: boolean;
  role: string;
}

// ==========================================
// 2. CONTAS FIXAS DO SISTEMA
// ==========================================

export const CONTAS_SISTEMA_FIXAS: ContaEspecial[] = [
  {
    username: "dede336",
    senhaHash: process.env.SEED_ADMIN_PASSWORD ?? "SET_ADMIN_PASSWORD",
    cargo: "ADMIN",
    isAdmin: true,
    role: "admin",
    permissoes: [
      "enviar_correio_global",
      "enviar_digimon_recompensa",
      "configurar_gacha",
      "travar_troca_hunter",
      "alternar_rede_global",
    ],
  },
  {
    username: "rimuru336",
    senhaHash: process.env.SEED_CREATOR_PASSWORD ?? "SET_CREATOR_PASSWORD",
    cargo: "ASSISTENTE",
    isAdmin: false,
    role: "digimon_creator",
    permissoes: [
      "enviar_correio_global",
      "enviar_digimon_recompensa",
      "visualizar_logs",
    ],
  },
];

// ==========================================
// 3. SISTEMA DE INICIALIZAÇÃO
// ==========================================

export class InicializadorSistema {
  /**
   * Garante que as contas Admin e Assistente existam no banco de dados.
   * Roda durante a inicialização do servidor.
   */
  public async garantirContasEspeciais(): Promise<void> {
    console.log("⚙️ Verificando integridade das contas de administração...");

    for (const conta of CONTAS_SISTEMA_FIXAS) {
      const [existente] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, conta.username))
        .limit(1);

      const senhaSegura = await bcrypt.hash(conta.senhaHash, 10);

      if (!existente) {
        await db.insert(usersTable).values({
          username: conta.username,
          passwordHash: senhaSegura,
          isAdmin: conta.isAdmin,
          role: conta.role,
        });
        console.log(
          `✅ Conta de ${conta.cargo} (${conta.username}) injetada com sucesso no banco de dados!`
        );
      } else {
        await db
          .update(usersTable)
          .set({ isAdmin: conta.isAdmin, role: conta.role, passwordHash: senhaSegura, updatedAt: new Date() })
          .where(eq(usersTable.username, conta.username));
        console.log(
          `🔒 Conta de ${conta.cargo} (${conta.username}) já operacional e sincronizada.`
        );
      }
    }
  }

  /**
   * Verifica se um username tem uma determinada permissão
   */
  public async verificarPermissao(username: string, permissao: string): Promise<boolean> {
    const conta = CONTAS_SISTEMA_FIXAS.find((c) => c.username === username);
    if (!conta) return false;
    return conta.permissoes.includes(permissao);
  }

  /**
   * Retorna o cargo de uma conta especial pelo username
   */
  public getCargoByUsername(username: string): CargoUsuario | null {
    return CONTAS_SISTEMA_FIXAS.find((c) => c.username === username)?.cargo ?? null;
  }
}

export const inicializadorSistema = new InicializadorSistema();
