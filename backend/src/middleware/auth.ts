import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../lib/prisma";

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Requires a valid JWT, either in the Authorization: Bearer header or
 * in an httpOnly `token` cookie. Attaches `req.userId` on success.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = bearerToken ?? req.cookies?.token;

    if (!token) {
      throw new AppError(401, "Authentication required.");
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError(401, "Invalid authentication token.");
    }

    req.userId = user.id;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, "Invalid or expired authentication token."));
  }
}

/**
 * Requires that req.userId is a member of the group identified by
 * req.params.groupId. Must run after requireAuth.
 */
export async function requireGroupMember(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const groupId = req.params.groupId;
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId! } },
    });
    if (!membership) {
      throw new AppError(403, "You must be a member of this group.");
    }
    next();
  } catch (err) {
    next(err);
  }
}
