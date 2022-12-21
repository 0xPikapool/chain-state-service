import { ethers } from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import erc20Abi from './abi/erc20';

@Injectable()
export class ChainService {
  readonly provider: ethers.providers.JsonRpcProvider;
  readonly tokenContract: ethers.Contract;
  private readonly logger = new Logger(ChainService.name);
  private readonly settlementContractAddr: string;

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
    this.tokenContract = new ethers.Contract(
      tokenContractAddr,
      erc20Abi,
      this.provider,
    );
    this.settlementContractAddr = settlementContractAddr;
  }

  async getLogsBetween(fromBlock: number, toBlock: number): Promise<any> {
    const filter = this.buildFilter(fromBlock, toBlock);
    try {
      const logs = await this.provider.getLogs(filter);
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

  private buildFilter(
    fromBlock: number,
    toBlock: number,
  ): ethers.providers.Filter {
    const base = this.tokenContract.filters.Approval(
      null,
      this.settlementContractAddr,
      null,
    );
    return {
      ...base,
      fromBlock,
      toBlock,
    };
  }
}
