import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid Authorization header');
      }

      const token = authHeader.substring(7);
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });

      const user = await this.userModel.findById(payload.sub).select('email roles').lean();
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Role-based admin check
      const roles: string[] = Array.isArray((user as any).roles) ? (user as any).roles : [];
      if (!roles.includes('admin')) {
        throw new ForbiddenException('Admin access required');
      }

      // Attach user to request for downstream if needed
      (req as any).adminUserEmail = user.email;

      return next();
    } catch (err) {
      const status = (err as any)?.status || 401;
      const message = (err as any)?.message || 'Unauthorized';
      res.status(status).json({ statusCode: status, message });
    }
  }
}
