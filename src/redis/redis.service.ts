import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, utils } from 'ethers';
import { default as Redis } from 'ioredis';

// There are only ~120M eth in existence, so this is a safe upper bound
const U32_MAX_VALUE = BigNumber.from(2).pow(32).sub(1);

/**
 * @module
 * @description Responsible for all interactions with Redis.
 */
@Injectable()
export class RedisService {
  readonly client: Redis;
  readonly networkId: string;
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

    // Take the first 2 bytes as the Id
    this.settlementContractId = settlementContractAddr.substring(2, 6);

    this.client = new Redis({
      host,
      port,
      db: networkId,
    });
    this.logger.log('Hello redis');
  }

  /**
   * Set current block number state in redis is synced to.
   */
  async setSyncedBlock(blockNumber: number) {
    return this.client.set('syncedBlock', blockNumber);
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
    // check if value is the max uint256
    const valueToUse = value.gte(U32_MAX_VALUE)
      ? 'GTE_U32'
      : utils.formatUnits(value);
    return this.client.hmset(key, {
      lastApproveValue: valueToUse,
      lastApproveBlock: blockNumber.toString(),
    });
  }

  /**
   * @description Get the last block number the owner has approved. -1 if never.
   * @param owner Owner of the approval
   * @returns
   */
  async getLastApprovalBlock(owner: string): Promise<number> {
    const key = this.buildOwnerKey(owner);
    const latestApproval = await this.client.hget(key, 'lastApprovalBlock');
    if (latestApproval) {
      return parseInt(latestApproval, 10);
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
