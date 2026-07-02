import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const esProduccion = process.env.NODE_ENV === 'production';

  app.setGlobalPrefix('api/v1');

  // Cabeceras de seguridad HTTP. La CSP por defecto de helmet rompe el UI de
  // Swagger (scripts inline); como Swagger solo se publica fuera de producción,
  // la CSP se relaja únicamente ahí.
  app.use(helmet({ contentSecurityPolicy: esProduccion ? undefined : false }));
  app.use(compression());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS: en producción SOLO los orígenes de CORS_ORIGIN (la validación de
  // entorno garantiza que exista y no sea '*'); admite lista separada por comas.
  // En desarrollo, sin la variable, se mantiene abierto (se usa el proxy de ng serve).
  const origenes = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origenes?.length ? origenes : !esProduccion,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Swagger: nunca en producción salvo opt-in explícito (SWAGGER_HABILITADO=true)
  const swaggerHabilitado = !esProduccion || process.env.SWAGGER_HABILITADO === 'true';
  if (swaggerHabilitado) {
    const config = new DocumentBuilder()
      .setTitle('BusRide API')
      .setDescription('Sistema de rutas y abordaje de autobuses')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`BusRide API corriendo en el puerto ${port} (prefijo /api/v1)`);
  if (swaggerHabilitado) logger.log(`Swagger docs: /api/docs`);
}
bootstrap();
