import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  const error = err as { message?: string; code?: string };
  console.error('[Error]', error);

  if (error.code === 'P2002') {
    res.status(409).json({ error: 'Record already exists' });
    return;
  }
  if (error.code === 'P2025') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
