import { hexZeroPad } from 'ethers/lib/utils';
import { Erc20 } from './chain/types/contracts';
import { TransferEventFilter } from './chain/types/contracts/Erc20';

// https://stackoverflow.com/a/26554873
export function* range(start: number, stop: number, step = 1) {
  if (stop == null) {
    // one param defined
    stop = start;
    start = 0;
  }

  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    yield i;
  }
}

const MAX_FILTER_TOPIC_SIZE = 10000;

export class TransferFilterGenerator {
  private fromFilters: FromTransferFilter[];
  private toFilters: ToTransferFilter[];
  private tokenContract: Erc20;
  private transferTopicId: string;

  constructor(tokenContract: Erc20, addresses: string[]) {
    this.tokenContract = tokenContract;
    this.fromFilters = [];
    this.toFilters = [];

    // Get the transfer topic id
    const transferTopics = this.tokenContract.filters.Transfer().topics;
    if (!transferTopics) throw new Error('Transfer filter has no topics');
    this.transferTopicId = transferTopics[0] as string;

    // Process all the addresses
    addresses.forEach(this.addAddress.bind(this));
  }

  getFromFilters() {
    return this.fromFilters as TransferEventFilter[];
  }

  getToFilters() {
    return this.toFilters as TransferEventFilter[];
  }

  private addAddress(address: string) {
    // Limit each filter to checking N addresses to avoid making the request
    // too heavy
    let lastFromFilterIdx = this.fromFilters.length - 1;
    let lastToFilterIdx = this.toFilters.length - 1;
    if (
      this.fromFilters.length === 0 ||
      this.fromFilters[lastFromFilterIdx].topics[1].length >=
        MAX_FILTER_TOPIC_SIZE
    ) {
      this.newFromFilter();
    }
    if (
      this.toFilters.length === 0 ||
      this.toFilters[lastToFilterIdx].topics[2].length >= MAX_FILTER_TOPIC_SIZE
    ) {
      this.newToFilter();
    }

    lastFromFilterIdx = this.fromFilters.length - 1;
    lastToFilterIdx = this.toFilters.length - 1;
    this.fromFilters[lastFromFilterIdx].topics[1].push(hexZeroPad(address, 32));
    this.toFilters[lastToFilterIdx].topics[2].push(hexZeroPad(address, 32));
  }

  private newFromFilter() {
    const newFilter: FromTransferFilter = {
      address: this.tokenContract.address,
      topics: [this.transferTopicId, []],
    };
    this.fromFilters.push(newFilter);
  }

  private newToFilter() {
    const newFilter: ToTransferFilter = {
      address: this.tokenContract.address,
      topics: [this.transferTopicId, null, []],
    };
    this.toFilters.push(newFilter);
  }
}

type TransferFilterFromTopics = [string, string[]];

type TransferFilterToTopics = [string, null, string[]];

interface FromTransferFilter {
  address: string;
  topics: TransferFilterFromTopics;
}

interface ToTransferFilter {
  address: string;
  topics: TransferFilterToTopics;
}
