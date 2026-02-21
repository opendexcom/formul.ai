import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PluginLoaderService } from './plugins/plugin-loader.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification (EE plugin) at POST /api/webhooks/stripe
  });

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('FormulAI API')
    .setDescription('API for FormulAI - Google Forms Clone')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Initialize plugins after app is created
  const pluginLoader = app.get(PluginLoaderService);
  await pluginLoader.initializePlugins(app);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);

  // Log loaded plugins
  const loadedPlugins = Array.from(pluginLoader['loadedPlugins'].keys());
  if (loadedPlugins.length > 0) {
    console.log(`🔌 Loaded plugins: ${loadedPlugins.join(', ')}`);
  } else {
    console.log(`🔌 No plugins loaded (OSS mode)`);
  }
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
