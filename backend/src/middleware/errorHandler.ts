import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { ZodError } from "zod";

/**
 * Minimal shape of a Prisma "known request error" that we care about.
 * We avoid importing `Prisma.PrismaClientKnownRequestError` directly
 * here because the generated Prisma namespace is only fully available
 * after `prisma generate` succeeds against a reachable engine binary;
 * this structural check works identically at runtime regardless.
 */
function isPrismaKnownRequestError(
  err: unknown
): err is { code: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "string" &&
    (err as any).constructor?.name === "PrismaClientKnownRequestError"
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (isPrismaKnownRequestError(err)) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A record with this value already exists.",
        errors: [err.meta],
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
        errors: [],
      });
    }
  }

  // eslint-disable-next-line no-console
  console.error("Unexpected error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error.",
    errors: [],
  });
}
