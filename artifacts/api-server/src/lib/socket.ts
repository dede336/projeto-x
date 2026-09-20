import { Server as IOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { db, usersTable, chatMessagesTable, globalChatMessagesTable } from "@workspace/db";
import { eq, or, and, desc } from "drizzle-orm";
import { logger } from "./logger.js";
import { randomUUID } from "crypto";
import { containsProfanity } from "./profanity.js";

export interface AuthPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  role: string;
}

// In-memory presence map: username → socketId
const onlineUsers = new Map<string, string>();

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(username: string): boolean {
  return onlineUsers.has(username);
}

// ─── Battle Types ────────────────────────────────────────────────────────────
export interface ActiveBattleMember {
  characterId: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  attackName: string;
  spiritName: string;
  level: number;
}

interface BattlePlayerState {
  socketId: string;
  team: ActiveBattleMember[];
  activeIdx: number;
  defending: boolean;
}

interface BattleRoom {
  id: string;
  players: Record<string, BattlePlayerState>;
  turn: string;
  log: string[];
  phase: "fighting" | "done";
  winner?: string;
}

// In-memory battle rooms and pending invites
const battleRooms = new Map<string, BattleRoom>();
const pendingInvites = new Map<string, {
  from: string;
  to: string;
  fromPlayerName: string;
  fromTeam: ActiveBattleMember[];
}>();

function buildStatePayload(room: BattleRoom) {
  return {
    battleId: room.id,
    turn: room.turn,
    log: room.log.slice(-30),
    phase: room.phase,
    winner: room.winner,
    players: Object.fromEntries(
      Object.entries(room.players).map(([name, p]) => [
        name,
        { team: p.team, activeIdx: p.activeIdx, defending: p.defending },
      ])
    ),
  };
}

let io: IOServer;

export function initSocket(httpServer: HTTPServer): IOServer {
  io = new IOServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["polling", "websocket"],
  });

  // Auth middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Missing token"));
      const secret = process.env["SESSION_SECRET"]!;
      const payload = jwt.verify(token, secret) as AuthPayload;
      (socket as any).auth = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const auth = (socket as any).auth as AuthPayload;
    const { username, userId } = auth;

    // Mark online
    onlineUsers.set(username, socket.id);
    logger.info({ username }, "[socket] connected");

    socket.emit("presence:list", getOnlineUsers());
    socket.broadcast.emit("presence:update", { username, online: true });

    // ── Global Chat ───────────────────────────────────────────────────────────
    socket.on("global:send", async (data: { content: string }) => {
      try {
        const { content } = data;
        if (!content?.trim()) return;

        if (containsProfanity(content)) {
          socket.emit("global:error", { message: "Mensagem contém palavras ofensivas e não foi enviada." });
          return;
        }

        const [saved] = await db
          .insert(globalChatMessagesTable)
          .values({ fromUserId: userId, content: content.trim() })
          .returning();

        const payload = {
          id: saved.id,
          from: username,
          content: saved.content,
          createdAt: saved.createdAt.toISOString(),
        };

        io.emit("global:message", payload);
      } catch (err) {
        logger.error({ err }, "[socket] global:send error");
      }
    });

    // ── Chat ──────────────────────────────────────────────────────────────────
    socket.on("chat:send", async (data: { to: string; content: string }) => {
      try {
        const { to, content } = data;
        if (!to || !content?.trim()) return;

        const [recipient] = await db
          .select({ id: usersTable.id, username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.username, to))
          .limit(1);

        if (!recipient) return;

        const [saved] = await db
          .insert(chatMessagesTable)
          .values({ fromUserId: userId, toUserId: recipient.id, content: content.trim() })
          .returning();

        const messagePayload = {
          id: saved.id,
          from: username,
          to,
          content: saved.content,
          createdAt: saved.createdAt.toISOString(),
        };

        socket.emit("chat:message", messagePayload);
        const recipientSocketId = onlineUsers.get(to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("chat:message", messagePayload);
        }
      } catch (err) {
        logger.error({ err }, "[socket] chat:send error");
      }
    });

    // ── Battle: Send Invite ───────────────────────────────────────────────────
    socket.on("battle:invite", (data: {
      to: string;
      team: ActiveBattleMember[];
      playerName: string;
    }) => {
      const { to, team, playerName } = data;
      const recipientSocketId = onlineUsers.get(to);
      if (!recipientSocketId) {
        socket.emit("battle:error", { message: "Jogador está offline. Convite não entregue." });
        return;
      }

      const inviteId = randomUUID();
      pendingInvites.set(inviteId, { from: username, to, fromPlayerName: playerName, fromTeam: team });

      io.to(recipientSocketId).emit("battle:invite", {
        inviteId,
        from: username,
        fromPlayerName: playerName,
        team,
      });

      socket.emit("battle:invite_sent", { inviteId, to });

      // Auto-expire after 60s
      setTimeout(() => {
        if (!pendingInvites.has(inviteId)) return;
        pendingInvites.delete(inviteId);
        socket.emit("battle:invite_expired", { inviteId });
        const recSock = onlineUsers.get(to);
        if (recSock) io.to(recSock).emit("battle:invite_expired", { inviteId });
      }, 60_000);
    });

    // ── Battle: Accept Invite ─────────────────────────────────────────────────
    socket.on("battle:accept", (data: {
      inviteId: string;
      team: ActiveBattleMember[];
      playerName: string;
    }) => {
      const { inviteId, team, playerName } = data;
      const invite = pendingInvites.get(inviteId);
      if (!invite) {
        socket.emit("battle:error", { message: "Convite expirado ou inválido." });
        return;
      }
      pendingInvites.delete(inviteId);

      const challengerSocketId = onlineUsers.get(invite.from);
      if (!challengerSocketId) {
        socket.emit("battle:error", { message: "Desafiante ficou offline." });
        return;
      }

      const battleId = randomUUID();
      const room: BattleRoom = {
        id: battleId,
        players: {
          [invite.from]: {
            socketId: challengerSocketId,
            team: invite.fromTeam,
            activeIdx: 0,
            defending: false,
          },
          [username]: {
            socketId: socket.id,
            team,
            activeIdx: 0,
            defending: false,
          },
        },
        turn: invite.from, // challenger goes first
        log: [`⚔️ Batalha iniciada! Vez de ${invite.from}!`],
        phase: "fighting",
      };
      battleRooms.set(battleId, room);

      const statePayload = buildStatePayload(room);

      io.to(challengerSocketId).emit("battle:start", {
        battleId,
        state: statePayload,
        yourTurn: true,
        opponentName: username,
        opponentPlayerName: playerName,
      });
      socket.emit("battle:start", {
        battleId,
        state: statePayload,
        yourTurn: false,
        opponentName: invite.from,
        opponentPlayerName: invite.fromPlayerName,
      });
    });

    // ── Battle: Decline Invite ────────────────────────────────────────────────
    socket.on("battle:decline", (data: { inviteId: string }) => {
      const invite = pendingInvites.get(data.inviteId);
      if (!invite) return;
      pendingInvites.delete(data.inviteId);
      const challengerSocketId = onlineUsers.get(invite.from);
      if (challengerSocketId) {
        io.to(challengerSocketId).emit("battle:declined", { from: username });
      }
    });

    // ── Battle: Action ────────────────────────────────────────────────────────
    socket.on("battle:action", (data: {
      battleId: string;
      action: "normal" | "special" | "defend";
    }) => {
      const { battleId, action } = data;
      const room = battleRooms.get(battleId);
      if (!room || room.phase !== "fighting") return;
      if (room.turn !== username) {
        socket.emit("battle:error", { message: "Não é sua vez!" });
        return;
      }

      const defenderName = Object.keys(room.players).find((k) => k !== username)!;
      const attacker = room.players[username];
      const defender = room.players[defenderName];
      const attackerActive = attacker.team[attacker.activeIdx];
      const defenderActive = defender.team[defender.activeIdx];

      if (action === "defend") {
        attacker.defending = true;
        room.log.push(`🛡️ ${attackerActive.name} se defende! Próximo golpe reduzido.`);
      } else {
        const isSpecial = action === "special";
        const baseDmg = isSpecial
          ? Math.max(5, attackerActive.atk * attackerActive.level * 0.8 - defenderActive.def * defenderActive.level * 0.1)
          : Math.max(3, attackerActive.atk * attackerActive.level * 0.5 - defenderActive.def * defenderActive.level * 0.2);

        const roll = 0.85 + Math.random() * 0.3;
        let dmg = Math.ceil(baseDmg * roll);

        if (defender.defending) {
          dmg = Math.ceil(dmg * 0.6);
        }

        defenderActive.hp = Math.max(0, defenderActive.hp - dmg);
        const atkName = isSpecial
          ? (attackerActive.spiritName || `${attackerActive.attackName} Especial`)
          : attackerActive.attackName;

        const blockText = defender.defending ? " (BLOQUEADO -40%)" : "";
        room.log.push(`⚔️ ${attackerActive.name} usa ${atkName}${blockText}! -${dmg} HP`);

        if (defenderActive.hp === 0) {
          room.log.push(`💀 ${defenderActive.name} foi derrotado!`);
          defender.activeIdx++;
          if (defender.activeIdx >= defender.team.length) {
            room.phase = "done";
            room.winner = username;
            room.log.push(`🏆 ${username} venceu a batalha!`);
          } else {
            const next = defender.team[defender.activeIdx];
            room.log.push(`✨ ${next.name} entra em campo!`);
          }
        }
      }

      // Reset attacker's defend flag after opponent's turn processes
      // (it was set so defender.defending was checked; now reset for next cycle)
      defender.defending = false;

      if (room.phase === "fighting") {
        room.turn = defenderName;
      }

      const statePayload = buildStatePayload(room);

      for (const [pname, pstate] of Object.entries(room.players)) {
        const pSockId = onlineUsers.get(pname) ?? pstate.socketId;
        if (!pSockId) continue;
        if (room.phase === "done") {
          io.to(pSockId).emit("battle:end", {
            state: statePayload,
            winner: room.winner,
            youWon: room.winner === pname,
          });
        } else {
          io.to(pSockId).emit("battle:state", {
            state: statePayload,
            yourTurn: room.turn === pname,
          });
        }
      }

      if (room.phase === "done") {
        battleRooms.delete(battleId);
      }
    });

    // ── Battle: Surrender ─────────────────────────────────────────────────────
    socket.on("battle:surrender", (data: { battleId: string }) => {
      const room = battleRooms.get(data.battleId);
      if (!room || room.phase !== "fighting") return;
      const opponentName = Object.keys(room.players).find((k) => k !== username)!;
      room.phase = "done";
      room.winner = opponentName;
      room.log.push(`🏳️ ${username} se rendeu!`);
      const statePayload = buildStatePayload(room);
      for (const [pname, pstate] of Object.entries(room.players)) {
        const pSockId = onlineUsers.get(pname) ?? pstate.socketId;
        if (!pSockId) continue;
        io.to(pSockId).emit("battle:end", {
          state: statePayload,
          winner: opponentName,
          youWon: pname === opponentName,
          surrendered: true,
        });
      }
      battleRooms.delete(data.battleId);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      onlineUsers.delete(username);
      logger.info({ username }, "[socket] disconnected");
      socket.broadcast.emit("presence:update", { username, online: false });

      // Forfeit active battles
      for (const [battleId, room] of battleRooms.entries()) {
        if (room.players[username] && room.phase === "fighting") {
          const opponentName = Object.keys(room.players).find((k) => k !== username);
          if (opponentName) {
            room.phase = "done";
            room.winner = opponentName;
            room.log.push(`🏳️ ${username} desconectou. ${opponentName} venceu!`);
            const statePayload = buildStatePayload(room);
            const opSockId = onlineUsers.get(opponentName);
            if (opSockId) {
              io.to(opSockId).emit("battle:end", {
                state: statePayload,
                winner: opponentName,
                youWon: true,
                forfeit: true,
              });
            }
          }
          battleRooms.delete(battleId);
        }
      }
    });
  });

  return io;
}

export { io };
