import argon2 from "argon2";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/jwt";
import { RegisterInput, LoginInput } from "../validators/auth.validators";

export function toPublicUser(user: { id: string; username: string; email: string; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: RegisterInput) {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    throw new AppError(409, "An account with this email already exists.");
  }
  const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
  if (existingUsername) {
    throw new AppError(409, "This username is already taken.");
  }

  const passwordHash = await argon2.hash(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
    },
  });

  const token = signToken({ userId: user.id });
  return { user: toPublicUser(user), token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError(401, "Invalid email or password.");
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password.");
  }

  const token = signToken({ userId: user.id });
  return { user: toPublicUser(user), token };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found.");
  return toPublicUser(user);
}
