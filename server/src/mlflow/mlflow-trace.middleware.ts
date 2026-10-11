import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  createHttpSessionId,
  runWithMlflowTraceContext,
} from './mlflow-trace-context';

@Injectable()
export class MlflowTraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const sessionId = createHttpSessionId(req.headers['x-session-id']);
    res.setHeader('X-Session-ID', sessionId);

    runWithMlflowTraceContext({ sessionId }, () => {
      next();
    });
  }
}
