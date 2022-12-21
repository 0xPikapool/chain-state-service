import { ethers } from 'ethers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChainService {
  readonly provider: ethers.providers.JsonRpcProvider;

  constructor(config: ConfigService) {
    const rpcUrl = config.get<string>('ETH_RPC_URL');
    this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl);
  }
}
