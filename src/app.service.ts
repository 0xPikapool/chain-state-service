import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';
import { ChainService } from './chain/chain.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly redis: RedisService;
  private readonly chain: ChainService;
  private readonly config: ConfigService;

  constructor(config: ConfigService, redis: RedisService, chain: ChainService) {
    this.redis = redis;
    this.chain = chain;
    this.config = config;
    this.init();
  }

  async init() {
    const curSynced = await this.redis.getSyncedBlock();
    const deployBlock = this.config.get<number>(
      'SETTLEMENT_CONTRACT_DEPLOY_BLOCK',
    );
    this.logger.log({
      curSynced,
      deployBlock,
    });

    const block = await this.chain.provider.getBlockNumber();
    this.logger.log({
      block,
    });
  }
}
