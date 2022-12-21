import { ethers } from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Erc20, Erc20__factory } from './types/contracts';
import { ApprovalEvent, ApprovalEventFilter } from './types/contracts/Erc20';

/**
 * @module
 * @description Responsible for all interactions with the Ethereum blockchain.
 */
@Injectable()
export class ChainService {
  readonly provider: ethers.providers.JsonRpcProvider;
  readonly tokenContract: Erc20;
  private readonly logger = new Logger(ChainService.name);
  private readonly filter: ApprovalEventFilter;

  constructor(config: ConfigService) {
    const rpcUrl = config.get<string>('ETH_RPC_URL');
    const tokenContractAddr = config.get<string>('TOKEN_CONTRACT_ADDR');
    const settlementContractAddr = config.get<string>(
      'SETTLEMENT_CONTRACT_ADDR',
    );
    if (!tokenContractAddr) throw new Error('TOKEN_CONTRACT_ADDR is not set');
    if (!settlementContractAddr)
      throw new Error('SETTLEMENT_CONTRACT_ADDR is not set');

    this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl);
    this.tokenContract = Erc20__factory.connect(
      tokenContractAddr,
      this.provider,
    );
    this.filter = this.tokenContract.filters.Approval(
      null,
      settlementContractAddr,
      null,
    );
  }

  /**
   * @param fromBlock inclusive
   * @param toBlock inclusive
   * @returns All relevant Approval logs between fromBlock and toBlock
   */
  async getLogsBetween(fromBlock: number, toBlock: number): Promise<any> {
    try {
      const logs = await this.tokenContract.queryFilter<ApprovalEvent>(
        this.filter,
        fromBlock,
        toBlock,
      );
      return logs;
    } catch (error) {
      if (toBlock - fromBlock < 10) throw Error(error);

      // If it failed and there is a wide block raneg, maybe the res is too
      // large. Split it up over 2 requests and try again.
      this.logger.warn(
        `Couldn't get logs between ${fromBlock} and ${toBlock}, splitting into two requests`,
      );
      const midBlock = Math.floor((fromBlock + toBlock) / 2);
      const [l, r] = await Promise.all([
        this.getLogsBetween(fromBlock, midBlock),
        this.getLogsBetween(midBlock + 1, toBlock),
      ]);
      return [...l, ...r];
    }
  }
}
