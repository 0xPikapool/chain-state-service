import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';
import cliProgress from 'cli-progress';
import { ChainService } from './chain/chain.service';
import { range, AddressSpecificFilterGenerator } from './utility';
import {
  DepositEvent,
  WithdrawalEvent,
  ApprovalEvent,
  TransferEvent,
} from './chain/types/contracts/WETH';

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
  private readonly settlementContractDeployBlock: number;
  private progressBar: cliProgress.SingleBar;

  constructor(config: ConfigService, redis: RedisService, chain: ChainService) {
    this.redis = redis;
    this.chain = chain;
    this.settlementContractDeployBlock =
      config.get<number>('SETTLEMENT_CONTRACT_DEPLOY_BLOCK') || 0;

    this.init().then(() => this.run());
  }

  /**
   * @description Initialize async stuff before first run
   */
  async init() {
    await this.chain.init();
  }

  /**
   * @description Process all blocks from the last synced block to the
   * current block. When done, calls itself again after a sleep.
   */
  private async run() {
    const curSynced = await this.redis.getSyncedBlock();
    const curBlock = await this.chain.provider.getBlockNumber();

    // Don't bother syncing before the settlement contract was deployed
    const fromBlock = Math.max(curSynced, this.settlementContractDeployBlock);

    if (fromBlock < curBlock) {
      this.logger.log(`Syncing blocks ${fromBlock} to ${curBlock}`);
      await this.processBlockRangeInChunks(fromBlock, curBlock);
    }

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
    const filter = this.chain.buildApprovalFilter();
    const approvalEvents = await this.chain.getEventsBetween(
      fromBlock,
      toBlock,
      [filter],
    );

    // Process events one at a time
    await Promise.all(approvalEvents.map(this.processApprovalEvent.bind(this)));

    // Now get the full list of approvers, and any Transfers they made
    // in the current block range
    const fullApproverSet = await this.redis.getApproverSet();
    const { fromTransfers, toTransfers, deposits, withdrawals } =
      await this.getAllNewTransfers(fromBlock, toBlock, fullApproverSet);

    // Update redis with the new transfers and balances
    const curBlockRangeActiveApproverSet = new Set<string>();
    fromTransfers.forEach((t) => {
      curBlockRangeActiveApproverSet.add(t.args.src);
    });
    toTransfers.forEach((t) => {
      curBlockRangeActiveApproverSet.add(t.args.dst);
    });
    deposits.forEach((t) => {
      curBlockRangeActiveApproverSet.add(t.args.dst);
    });
    withdrawals.forEach((t) => {
      curBlockRangeActiveApproverSet.add(t.args.src);
    });
    approvalEvents.forEach((t) => {
      curBlockRangeActiveApproverSet.add(t.args.src);
    });
    const curBlockNumber = await this.chain.provider.getBlockNumber();
    await Promise.all(
      [...curBlockRangeActiveApproverSet].map(async (approver) => {
        const lastTransferBlockInRedis = await this.redis.getCurBalanceBlock(
          approver,
        );
        if (curBlockNumber > lastTransferBlockInRedis) {
          const blockBal = await this.chain.tokenContract?.balanceOf(approver, {
            blockTag: curBlockNumber,
          });
          if (!blockBal) throw new Error('No block balance');
          await this.redis.setLatestBalance(approver, blockBal, curBlockNumber);
        }
      }),
    );
  }

  private async getAllNewTransfers(
    fromBlock: number,
    toBlock: number,
    approverSet: Set<string>,
  ) {
    const transferFilterGenerator = new AddressSpecificFilterGenerator(
      this.chain.getTokenContract(),
      [...approverSet],
    );
    const fromTransfers = await this.chain.getEventsBetween<TransferEvent>(
      fromBlock,
      toBlock,
      transferFilterGenerator.getFromFilters(),
    );
    const toTransfers = await this.chain.getEventsBetween<TransferEvent>(
      fromBlock,
      toBlock,
      transferFilterGenerator.getToFilters(),
    );
    const deposits = await this.chain.getEventsBetween<DepositEvent>(
      fromBlock,
      toBlock,
      transferFilterGenerator.getDepositFilters(),
    );
    const withdrawals = await this.chain.getEventsBetween<WithdrawalEvent>(
      fromBlock,
      toBlock,
      transferFilterGenerator.getWithdrawalFilters(),
    );
    return { fromTransfers, toTransfers, deposits, withdrawals };
  }

  private async processApprovalEvent(event: ApprovalEvent) {
    const { args, blockNumber } = event;
    const { src: owner, wad: value } = args;

    // Sanity check that this is a more recent approval than the cur in redis
    const lastBlock = await this.redis.getCurApprovalBlock(owner);
    if (lastBlock >= blockNumber) return;

    // Update the approval in redis
    await this.redis.setLatestApproval(owner, value, blockNumber);
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
    this.progressBar = new cliProgress.SingleBar(
      { noTTYOutput: true, stream: process.stdout },
      cliProgress.Presets.shades_classic,
    );
    this.progressBar.start(toBlock - fromBlock, 0);
    for (const curFrom of range(fromBlock, toBlock, chunkSize)) {
      const curTo = Math.min(curFrom + CHUNK_SIZE, toBlock);
      await this.processBlockRange(curFrom, curTo);
      await this.redis.setSyncedBlock(curTo);
      this.progressBar.increment(curTo - curFrom);
    }
    this.progressBar.stop();
  }
}
