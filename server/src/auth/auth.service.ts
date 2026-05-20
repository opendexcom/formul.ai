import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { PluginContributionRegistry } from '@opendexcom/plugin-interface';
import { PLUGIN_CONTRIBUTION_REGISTRY } from '../plugins/plugin-contribution.registry';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../schemas/user.schema';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

import { EmailService } from '../forms/email.service';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private settingsService: SettingsService,
    @Inject(PLUGIN_CONTRIBUTION_REGISTRY)
    private readonly contributions: PluginContributionRegistry,
  ) {}

  async register(registerDto: RegisterDto) {
    const isRegistrationAllowed =
      await this.settingsService.isRegistrationAllowed();
    if (!isRegistrationAllowed) {
      throw new UnauthorizedException('Registration is currently disabled');
    }

    const { email, password, firstName, lastName } = registerDto;
    const body = registerDto as unknown as Record<string, unknown>;

    for (const ext of this.contributions.getRegistrationExtensions()) {
      await ext.validateRegister(body);
    }

    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      email: { $eq: email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const emailVerificationToken = crypto.randomUUID();

    // Create user
    const user = new this.userModel({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      isEmailVerified: false,
      emailVerificationToken,
    });

    await user.save();

    const registeredUser = {
      id: String(user._id),
      email: user.email,
    };
    for (const ext of this.contributions.getRegistrationExtensions()) {
      await ext.onUserRegistered?.(registeredUser, body);
    }

    // Send confirmation email
    await this.emailService.sendConfirmationEmail(
      email,
      emailVerificationToken,
    );

    return {
      message:
        'Registration successful. Please check your email to confirm your account.',
    };
  }

  async confirmEmail(token: string) {
    const user = await this.userModel.findOne({
      emailVerificationToken: { $eq: token },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    return {
      message: 'Email confirmed successfully. You can now login.',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userModel.findOne({ email: { $eq: email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please confirm your email address before logging in',
      );
    }

    // Generate JWT token
    const payload = { email: user.email, sub: user._id };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      token,
    };
  }

  async validateUser(payload: any): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return await this.userModel.findById(payload.sub).select('-password');
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email: { $eq: email } });

    // Always return success message to prevent email enumeration
    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    const user = await this.userModel.findOne({
      passwordResetToken: { $eq: token },
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return {
      message:
        'Password has been reset successfully. You can now login with your new password.',
    };
  }
}
