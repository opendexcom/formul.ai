import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FormsModule } from './forms/forms.module';
import { MigrationModule } from './migrations/migration.module';
import { AiModule } from './ai/ai.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/formulai', {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    }),
    AuthModule,
    FormsModule,
    MigrationModule,
    AiModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
