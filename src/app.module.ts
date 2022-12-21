import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { NodeService } from './node/node.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'provision')
          .default('development'),
        ETH_RPC_URL: Joi.string().uri(),
        NETWORK_ID: Joi.string(),
        REDIS_URL: Joi.string().uri(),
        TOKEN_CONTRACT_ADDR: Joi.string(),
        SETTLEMENT_CONTRACT_ADDR: Joi.string(),
      }),
    }),
  ],
  providers: [AppService, RedisService, NodeService],
})
export class AppModule {}
