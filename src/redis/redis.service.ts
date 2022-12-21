import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { default as Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  readonly networkId: string;

  constructor(config: ConfigService) {
    this.client = new Redis();
    this.logger.log('Hello redis');
    this.networkId = config.get<string>('NETWORK_ID');
  }

  getSyncedBlock() {
    return this.client.get(`${this.networkId}:syncedBlock`);
  }
}
