import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';
import { ChainService } from './chain/chain.service';
import { range } from './utility';

// Alchemy max blocks per event query is 2k
const CHUNK_SIZE = 2000;

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

  private async init() {
    // const curSynced = await this.redis.getSyncedBlock();
    const curBlock = await this.chain.provider.getBlockNumber();
    const deployBlock =
      this.config.get<number>('SETTLEMENT_CONTRACT_DEPLOY_BLOCK') || 0;
    this.logger.log({
      deployBlock,
      curBlock,
    });

    await this.processBlockRangeInChunks(deployBlock, curBlock - 1);
    this.logger.log('Done');
  }

  // Throttle processing CHUNK_SIZE blocks at a time
  private async processBlockRangeInChunks(fromBlock: number, toBlock: number) {
    for (const i of range(fromBlock, toBlock, CHUNK_SIZE)) {
      const j = Math.min(i + CHUNK_SIZE, toBlock);
      await this.processBlockRange(i, j);
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const logs = await this.chain.getLogsBetween(fromBlock, toBlock);
    this.logger.log({ logs: logs.length, fromBlock, toBlock });
  }
}
