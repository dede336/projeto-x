import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthPayload } from "./requireAuth.js";

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      const secret = process.env["SESSION_SECRET"]!;
      const payload = jwt.verify(token, secret) as AuthPayload;
      req.auth = payload;
    } catch {
      // ignore invalid tokens — treat as unauthenticated
    }
  }
  next();
}
