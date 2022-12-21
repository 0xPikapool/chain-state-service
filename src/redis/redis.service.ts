import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { default as Redis } from 'ioredis';

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

  async getSyncedBlock() {
    const syncedBlock = await this.client.get('syncedBlock');
    if (syncedBlock) {
      return parseInt(syncedBlock, 10);
    }

    return 0;
  }
}
