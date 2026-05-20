import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { SettingsModule } from '../settings/settings.module';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../schemas/user.schema';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';

import { FormsModule } from '../forms/forms.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: getCoreSchemaOrThrow(User.name) }]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) =>
        ({
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') as string,
          },
        }) as JwtModuleOptions,
      inject: [ConfigService],
    }),
    SettingsModule,
    forwardRef(() => FormsModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminBootstrapService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
