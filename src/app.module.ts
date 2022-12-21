import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { ChainService } from './chain/chain.service';

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
        NETWORK_ID: Joi.number(),
        REDIS_HOST: Joi.string(),
        REDIS_PORT: Joi.number().integer().positive(),
        TOKEN_CONTRACT_ADDR: Joi.string(),
        SETTLEMENT_CONTRACT_ADDR: Joi.string(),
        SETTLEMENT_CONTRACT_DEPLOY_BLOCK: Joi.number().positive().integer(),
      }),
    }),
  ],
  providers: [AppService, RedisService, ChainService],
})
export class AppModule {}
