import { ethers } from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Erc20,
  Erc20__factory,
  UniswapV2Router02__factory,
  UniswapV2Router02,
} from './types/contracts';
import { ApprovalEvent, ApprovalEventFilter } from './types/contracts/Erc20';

/**
 * @module
 * @description Responsible for all interactions with the Ethereum blockchain.
 */
@Injectable()
export class ChainService {
  readonly provider: ethers.providers.JsonRpcProvider;
  readonly settlementContract: UniswapV2Router02;
  private readonly logger = new Logger(ChainService.name);
  private tokenContract: Erc20 | undefined;
  private filter: ApprovalEventFilter;
  private config: ConfigService;

  constructor(config: ConfigService) {
    const rpcUrl = config.get<string>('ETH_RPC_URL');
    const settlementContractAddr = config.get<string>(
      'SETTLEMENT_CONTRACT_ADDR',
    );
    if (!settlementContractAddr)
      throw new Error('SETTLEMENT_CONTRACT_ADDR is not set');

    this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl);
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
    this.filter = this.tokenContract.filters.Approval(
      null,
      this.settlementContract.address,
      null,
    );
  }

  /**
   * @param fromBlock inclusive
   * @param toBlock inclusive
   * @returns All relevant Approval logs between fromBlock and toBlock
   */
  async getApprovalEventsBetween(
    fromBlock: number,
    toBlock: number,
  ): Promise<ApprovalEvent[]> {
    if (!this.tokenContract) throw new Error('Token contract not initialized');

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
        this.getApprovalEventsBetween(fromBlock, midBlock),
        this.getApprovalEventsBetween(midBlock + 1, toBlock),
      ]);
      return [...l, ...r];
    }
  }
}
