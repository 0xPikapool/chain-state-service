import './dd-tracer'; // must come before importing any instrumented module.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
}
bootstrap();
