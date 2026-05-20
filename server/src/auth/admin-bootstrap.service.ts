import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../schemas/user.schema';
import { isStrongPassword } from './validators/strong-password.validator';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrapAdminFromEnv();
  }

  async bootstrapAdminFromEnv(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD?.trim();

    if (!email && !password) {
      return;
    }

    if (!email || !password) {
      throw new Error(
        'Admin bootstrap requires both ADMIN_EMAIL and ADMIN_PASSWORD to be set',
      );
    }

    if (!isStrongPassword(password)) {
      throw new Error(
        'ADMIN_PASSWORD must be at least 8 characters and contain uppercase, lowercase, number, and special character',
      );
    }

    const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Admin';
    const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'User';

    const existing = await this.userModel.findOne({ email });
    if (existing) {
      const roles = new Set(existing.roles ?? ['user']);
      roles.add('admin');
      existing.roles = Array.from(roles);
      existing.isEmailVerified = true;
      existing.emailVerificationToken = undefined;
      await existing.save();
      this.logger.log(`Granted admin role to existing user ${email}`);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await this.userModel.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      roles: ['user', 'admin'],
      isEmailVerified: true,
    });

    this.logger.log(`Created bootstrap admin user ${email}`);
  }
}
