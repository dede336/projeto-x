import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

function signToken(userId: number, username: string, isAdmin: boolean, role: string) {
  const secret = process.env["SESSION_SECRET"]!;
  return jwt.sign({ userId, username, isAdmin, role }, secret, { expiresIn: "30d" });
}

function isEmailFormat(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// POST /auth/register
router.post("/register", async (req, res) => {
  const { username, password, email } = req.body as { username?: string; password?: string; email?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username e password são obrigatórios" });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: "Username deve ter entre 3 e 20 caracteres" });
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: "Username só pode conter letras, números e _" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" });
    return;
  }
  const EXEMPT_USERNAMES = ["dede336", "rimuru336"];
  const isExempt = EXEMPT_USERNAMES.includes(username.toLowerCase());

  const normalizedEmail = email?.trim().toLowerCase() || null;
  if (!normalizedEmail && !isExempt) {
    res.status(400).json({ error: "E-mail é obrigatório para criar uma conta" });
    return;
  }
  if (normalizedEmail) {
    if (!isEmailFormat(normalizedEmail)) {
      res.status(400).json({ error: "E-mail inválido" });
      return;
    }
    const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (existingEmail.length > 0) {
      res.status(409).json({ error: "E-mail já está em uso" });
      return;
    }
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username já está em uso" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const isAdminAccount = username === "dede336";
  const [user] = await db
    .insert(usersTable)
    .values({ username, email: normalizedEmail, passwordHash, role: "user", isAdmin: isAdminAccount })
    .returning();
  const token = signToken(user.id, user.username, user.isAdmin, user.role);
  res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, role: user.role, createdAt: user.createdAt } });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "usuário/e-mail e senha são obrigatórios" });
    return;
  }
  const isEmail = isEmailFormat(username.trim());
  const lookup = isEmail
    ? eq(usersTable.email, username.trim().toLowerCase())
    : eq(usersTable.username, username.trim());
  const [user] = await db.select().from(usersTable).where(lookup).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }
  const token = signToken(user.id, user.username, user.isAdmin, user.role);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, role: user.role, createdAt: user.createdAt } });
});

// GET /auth/me
router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, role: user.role, createdAt: user.createdAt });
});

export default router;
