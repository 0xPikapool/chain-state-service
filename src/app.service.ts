import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';
import { NodeService } from './node/node.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly redis: RedisService;
  private readonly ethNode: NodeService;
  private readonly config: ConfigService;

  constructor(
    config: ConfigService,
    redis: RedisService,
    ethNode: NodeService,
  ) {
    this.redis = redis;
    this.ethNode = ethNode;
    this.config = config;
    this.run();
  }

  async run() {
    this.logger.log('Hello nest');
    await new Promise((r) => setTimeout(r, 1000));
    this.run();
  }
}
