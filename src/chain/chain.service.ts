import { ethers } from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Erc20,
  Erc20__factory,
  UniswapV2Router02__factory,
  UniswapV2Router02,
} from './types/contracts';
import {
  ApprovalEventFilter,
  TransferEventFilter,
} from './types/contracts/Erc20';
import { TypedEvent } from './types/contracts/common';

/**
 * @module
 * @description Responsible for all interactions with the Ethereum blockchain.
 */
@Injectable()
export class ChainService {
  readonly provider: ethers.providers.AlchemyProvider;
  readonly settlementContract: UniswapV2Router02;
  private readonly logger = new Logger(ChainService.name);
  private config: ConfigService;
  tokenContract: Erc20 | undefined;

  constructor(config: ConfigService) {
    const alchemyApiKey = config.get<string>('ALCHEMY_API_KEY');
    const networkId = config.get<number>('NETWORK_ID');
    const settlementContractAddr = config.get<string>(
      'SETTLEMENT_CONTRACT_ADDR',
    );
    if (!settlementContractAddr)
      throw new Error('SETTLEMENT_CONTRACT_ADDR is not set');

    this.provider = new ethers.providers.AlchemyProvider(
      networkId,
      alchemyApiKey,
    );
    this.settlementContract = UniswapV2Router02__factory.connect(
      settlementContractAddr,
      this.provider,
    );
    this.config = config;
  }

  /**
   * @description Perform async setup
   * TODO: Replace UniswapV2Router with settlement contract
   */
  async init() {
    const tokenContractAddr = await this.settlementContract.WETH();
    const actualNetworkId = (await this.provider.getNetwork()).chainId;
    const configNetworkId = this.config.get<number>('NETWORK_ID');
    if (configNetworkId !== actualNetworkId) {
      throw new Error(
        `NETWORK_ID is set to ${configNetworkId} but the actual network id is ${actualNetworkId}`,
      );
    }
    this.tokenContract = Erc20__factory.connect(
      tokenContractAddr,
      this.provider,
    );
  }

  /**
   * @param fromBlock inclusive
   * @param toBlock inclusive
   * @param filters filters to run
   * @returns All relevant Approval logs between fromBlock and toBlock
   */
  async getEventsBetween<TE extends TypedEvent<any, any>>(
    fromBlock: number,
    toBlock: number,
    filters: (TransferEventFilter | ApprovalEventFilter)[],
  ): Promise<TE[]> {
    const all = [];

    // Process each filter just one at a time to not overwhelm alchemy
    for (const filter of filters) {
      try {
        const logs = await this.getTokenContract().queryFilter<TE>(
          filter,
          fromBlock,
          toBlock,
        );
        all.push(...logs);
      } catch (error) {
        if (toBlock - fromBlock < 10) throw Error(error);

        // If it failed and there is a wide block raneg, maybe the res is too
        // large. Split it up over 2 requests and try again.
        this.logger.warn(
          `Couldn't get logs between ${fromBlock} and ${toBlock}, splitting into two requests`,
        );
        const midBlock = Math.floor((fromBlock + toBlock) / 2);
        const [l, r] = await Promise.all([
          this.getEventsBetween<TE>(fromBlock, midBlock, [filter]),
          this.getEventsBetween<TE>(midBlock + 1, toBlock, [filter]),
        ]);
        all.push(...l, ...r);
      }
    }

    return all;
  }

  /**
   * @returns A filter that matches all approvals for the settlement contract
   */
  buildApprovalFilter(): ApprovalEventFilter {
    if (!this.tokenContract) throw new Error('Token contract not initialized');
    return this.tokenContract.filters.Approval(
      null,
      this.settlementContract.address,
      null,
    );
  }

  getTokenContract(): Erc20 {
    if (!this.tokenContract) throw new Error('Token contract not initialized');
    return this.tokenContract;
  }
}
