import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';
import { ChainService } from './chain/chain.service';
import { range } from './utility';

// Alchemy max blocks per event query is 2k
const CHUNK_SIZE = 2000;

// Ms to wait between checking for a new block
const SLEEP = 1000;

/**
 * @module
 * @description Service entrypoint.
 * The .run() method is called on instantiation, which kicks off the core
 * service logic of the app and keeps it running.
 */
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
    this.run();
  }

  /**
   * @description Process all blocks from the last synced block to the
   * current block. When done, calls itself again after a sleep.
   */
  private async run() {
    const curSynced = await this.redis.getSyncedBlock();
    const curBlock = await this.chain.provider.getBlockNumber();
    const deployBlock =
      this.config.get<number>('SETTLEMENT_CONTRACT_DEPLOY_BLOCK') || 0;

    // Don't bother syncing before the settlement contract was deployed
    const fromBlock = Math.max(curSynced + 1, deployBlock);

    await this.processBlockRangeInChunks(fromBlock, curBlock - 1);

    setTimeout(this.run.bind(this), SLEEP);
  }

  /**
   * @param fromBlock inclusive
   * @param toBlock inclusive
   * @description Process all blocks from fromBlock to toBlock
   * - Gets all Approvals to the token contract for the settlement contract
   * - Gets the WETH balance of every
   */
  private async processBlockRange(fromBlock: number, toBlock: number) {
    const logs = await this.chain.getLogsBetween(fromBlock, toBlock);
    this.logger.log({ logs: logs.length, fromBlock, toBlock });
  }

  /**
   *
   * @param fromBlock inclusive
   * @param toBlock inclusive
   * @param chunkSize
   * @description Process all blocks from fromBlock to toBlock in chunks of chunkSize
   * Useful for Alchemy which has a max block range of 2k.
   */
  private async processBlockRangeInChunks(
    fromBlock: number,
    toBlock: number,
    chunkSize = CHUNK_SIZE,
  ) {
    for (const i of range(fromBlock, toBlock, chunkSize)) {
      const j = Math.min(i + CHUNK_SIZE, toBlock);
      await this.processBlockRange(i, j);
    }
  }
}
