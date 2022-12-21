import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { default as Redis } from 'ioredis';

/**
 * @module
 * @description Responsible for all interactions with Redis.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  readonly networkId: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST');
    const port = config.get<number>('REDIS_PORT');
    const networkId = config.get<number>('NETWORK_ID');
    this.client = new Redis({
      host,
      port,
      db: networkId,
    });
    this.logger.log('Hello redis');
  }

  /**
   * @returns The block number state in redis is synced to.
   */
  async getSyncedBlock() {
    const syncedBlock = await this.client.get('syncedBlock');
    if (syncedBlock) {
      return parseInt(syncedBlock, 10);
    }

    return 0;
  }
}
