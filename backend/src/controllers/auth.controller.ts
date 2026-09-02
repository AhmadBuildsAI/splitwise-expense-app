import { Request, Response } from "express";
import { registerSchema, loginSchema } from "../validators/auth.validators";
import * as authService from "../services/auth.service";
import { AuthedRequest } from "../middleware/auth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const { user, token } = await authService.registerUser(input);
  res.cookie("token", token, COOKIE_OPTIONS);
  res.status(201).json({ success: true, data: { user, token } });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { user, token } = await authService.loginUser(input);
  res.cookie("token", token, COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { user, token } });
}

export async function logout(req: Request, res: Response) {
  res.clearCookie("token");
  res.status(200).json({ success: true, data: { message: "Logged out." } });
}

export async function me(req: AuthedRequest, res: Response) {
  const user = await authService.getUserById(req.userId!);
  res.status(200).json({ success: true, data: { user } });
}
