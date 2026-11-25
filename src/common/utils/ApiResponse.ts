import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    meta?: PaginationMeta | Record<string, unknown>
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static created<T>(
    res: Response,
    data: T,
    message = 'Resource created successfully',
    meta?: PaginationMeta | Record<string, unknown>
  ) {
    return res.status(201).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static noContent(res: Response) {
    return res.status(204).send();
  }
}

