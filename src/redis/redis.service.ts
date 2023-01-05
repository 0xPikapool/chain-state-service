import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, constants } from 'ethers';
import { default as Redis } from 'ioredis';

/**
 * @module
 * @description Responsible for all interactions with Redis.
 */
@Injectable()
export class RedisService {
  readonly client: Redis;
  readonly networkId: string;
  private approversCache: Set<string>;
  private readonly settlementContractId: string;
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST');
    const port = config.get<number>('REDIS_PORT');
    const networkId = config.get<number>('NETWORK_ID');
    const settlementContractAddr = config.get<string>(
      'SETTLEMENT_CONTRACT_ADDR',
    );
    if (!settlementContractAddr)
      throw new Error('SETTLEMENT_CONTRACT_ADDR is not set');

    this.settlementContractId = `${networkId}:${settlementContractAddr
      .substring(2, 6)
      .toLowerCase()}`;

    this.client = new Redis({
      host,
      port,
      db: 0,
    });
    this.approversCache = new Set();
  }

  /**
   * Set current block number state in redis is synced to.
   */
  async setSyncedBlock(blockNumber: number) {
    return this.client.set(
      `${this.settlementContractId}:syncedBlock`,
      blockNumber,
    );
  }

  /**
   * @returns The block number state in redis is synced to.
   */
  async getSyncedBlock() {
    const syncedBlock = await this.client.get(
      `${this.settlementContractId}:syncedBlock`,
    );
    if (syncedBlock) {
      return parseInt(syncedBlock, 10);
    }

    return 0;
  }

  /**
   * @description Get the last block number the owner has approved. -1 if never.
   * @param owner Owner of the approval
   * @returns
   */
  async setLatestApproval(
    owner: string,
    value: BigNumber,
    blockNumber: number,
  ) {
    const key = this.buildOwnerKey(owner);
    const valueToUse = value.gte(constants.MaxInt256)
      ? 'MAX_INT256'
      : value.toString();

    this.approversCache.add(owner);
    return this.client
      .multi()
      .hmset(key, {
        approveValue: valueToUse,
        approveBlock: blockNumber.toString(),
      })
      .sadd(`${this.settlementContractId}:approvers`, owner)
      .exec();
  }

  /**
   * @description Get the last block number the owner has approved. -1 if never.
   * @param owner Owner of the approval
   * @returns
   */
  async setLatestBalance(owner: string, value: BigNumber, blockNumber: number) {
    const key = this.buildOwnerKey(owner);

    this.approversCache.add(owner);
    return this.client
      .multi()
      .hmset(key, {
        balanceValue: value.toString(),
        balanceBlock: blockNumber.toString(),
      })
      .exec();
  }

  /**
   * @returns All owners that have approved the settlement contract
   * @dev This can be big, so get it with an sscan not smembers
   */
  async getApproverSet(): Promise<Set<string>> {
    if (this.approversCache.size > 0) {
      // Sanity check to make sure our cache contains the same amt of approvers
      // as redis
      const inRedis = await this.client.scard(
        `${this.settlementContractId}:approvers`,
      );
      if (inRedis === this.approversCache.size) {
        // Cache is good
        return Promise.resolve(this.approversCache);
      }

      // Something wrong with the cache, clear it and rebuild
      this.logger.warn(
        `Approvers cache size ${this.approversCache.size} does not match redis size ${inRedis}. Clearing in-memory cache and rebuilding.`,
      );
      this.approversCache.clear();
    }

    // Cache needs to be built
    const stream = this.client.sscanStream(
      `${this.settlementContractId}:approvers`,
      { count: 1000 },
    );
    await new Promise((resolve, reject) => {
      stream.on('data', (resultKeys: string[]) => {
        // `resultKeys` is an array of strings representing key names.
        // Note that resultKeys may contain 0 keys, and that it will sometimes
        // contain duplicates due to SCAN's implementation in Redis.
        for (let i = 0; i < resultKeys.length; i++) {
          this.approversCache.add(resultKeys[i]);
        }
      });
      stream.on('end', () => {
        resolve(null);
      });
      stream.on('error', (e) => {
        reject(e);
      });
    });

    return this.approversCache;
  }

  /**
   * @description Get the last block number the owner has approved. -1 if never.
   * @param owner Owner of the approval
   * @returns
   */
  async getCurApprovalBlock(owner: string): Promise<number> {
    const key = this.buildOwnerKey(owner);
    const latestApproval = await this.client.hget(key, 'lastApprovalBlock');
    if (latestApproval) {
      return parseInt(latestApproval, 10);
    }

    return -1;
  }

  /**
   * @description Get the last block number the owner has approved. -1 if never.
   * @param owner Owner of the approval
   * @returns
   */
  async getCurBalanceBlock(owner: string): Promise<number> {
    const key = this.buildOwnerKey(owner);
    const latestBalanceBlock = await this.client.hget(key, 'balanceBlock');
    if (latestBalanceBlock) {
      return parseInt(latestBalanceBlock, 10);
    }

    return -1;
  }

  /**
   *
   * @param owner Owner of the approval
   * @returns Redis key
   */
  buildOwnerKey(owner: string) {
    return `${this.settlementContractId}:${owner.substring(2).toLowerCase()}`;
  }
}
