import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Documentation
  // Enable Swagger if SWAGGER_ENABLED is true, or if NODE_ENV is development, or if not set (default to enabled)
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED !== 'false' &&
    (process.env.SWAGGER_ENABLED === 'true' ||
      process.env.NODE_ENV === 'development' ||
      !process.env.NODE_ENV);

  const swaggerPath = process.env.SWAGGER_PATH || 'api/docs';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Leviate API')
      .setDescription('Leviate Task Marketplace API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Authentication', 'User authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Tasks', 'Task/Job management endpoints')
      .addTag('Wallet', 'Wallet and ledger endpoints')
      .addTag('Admin', 'Admin control endpoints')
      .addTag('Notifications', 'Notification endpoints')
      .addTag('Banks', 'Bank account and withdrawal management endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  const port = process.env.PORT || 3000;
  // Listen on all interfaces (0.0.0.0) to allow Caddy reverse proxy
  await app.listen(port, '0.0.0.0');
  console.log(`\n🚀 Application is running on: http://localhost:${port}\n`);
  
  if (swaggerEnabled) {
    console.log(`📚 Swagger documentation: http://localhost:${port}/${swaggerPath}`);
    console.log(`📄 Swagger JSON: http://localhost:${port}/${swaggerPath}-json\n`);
  } else {
    console.log('⚠️  Swagger is disabled. Set SWAGGER_ENABLED=true to enable.\n');
  }
}
bootstrap();
