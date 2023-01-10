import { hexZeroPad } from 'ethers/lib/utils';
import { WETH } from './chain/types/contracts';
import { TransferEventFilter } from './chain/types/contracts/WETH';

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

export class AddressSpecificFilterGenerator {
  private fromFilters: FromTransferFilter[];
  private toFilters: ToTransferFilter[];
  private depositFilters: DepositFilter[];
  private withdrawalFilters: WithdrawalFilter[];
  private tokenContract: WETH;
  private transferTopicId: string;
  private depositTopicId: string;
  private withdrawalTopicId: string;

  constructor(tokenContract: WETH, addresses: string[]) {
    this.tokenContract = tokenContract;
    this.fromFilters = [];
    this.toFilters = [];
    this.depositFilters = [];
    this.withdrawalFilters = [];

    // Store transfer topic id
    const transferTopics = this.tokenContract.filters.Transfer().topics;
    if (!transferTopics) throw new Error('Transfer filter has no topics');
    this.transferTopicId = transferTopics[0] as string;

    // Store deposit topic id
    const depositTopics = this.tokenContract.filters.Deposit().topics;
    if (!depositTopics) throw new Error('Deposit filter has no topics');
    this.depositTopicId = depositTopics[0] as string;

    // Store withdrawal topic id
    const withdrawalTopics = this.tokenContract.filters.Withdrawal().topics;
    if (!withdrawalTopics) throw new Error('Withdrawal filter has no topics');
    this.withdrawalTopicId = withdrawalTopics[0] as string;

    // Process all the addresses
    addresses.forEach(this.addAddress.bind(this));
  }

  getDepositFilters() {
    return this.depositFilters as DepositFilter[];
  }

  getWithdrawalFilters() {
    return this.withdrawalFilters as WithdrawalFilter[];
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
    let lastDepositFilterIdx = this.depositFilters.length - 1;
    let lastWithdrawalFilterIdx = this.withdrawalFilters.length - 1;
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
    if (
      this.depositFilters.length === 0 ||
      this.depositFilters[lastDepositFilterIdx].topics[1].length >=
        MAX_FILTER_TOPIC_SIZE
    ) {
      this.newDepositFilter();
    }
    if (
      this.withdrawalFilters.length === 0 ||
      this.withdrawalFilters[lastWithdrawalFilterIdx].topics[1].length >=
        MAX_FILTER_TOPIC_SIZE
    ) {
      this.newWithdrawalFilter();
    }

    lastFromFilterIdx = this.fromFilters.length - 1;
    lastToFilterIdx = this.toFilters.length - 1;
    lastDepositFilterIdx = this.depositFilters.length - 1;
    lastWithdrawalFilterIdx = this.withdrawalFilters.length - 1;
    this.fromFilters[lastFromFilterIdx].topics[1].push(hexZeroPad(address, 32));
    this.toFilters[lastToFilterIdx].topics[2].push(hexZeroPad(address, 32));
    this.withdrawalFilters[lastWithdrawalFilterIdx].topics[1].push(
      hexZeroPad(address, 32),
    );
    this.depositFilters[lastDepositFilterIdx].topics[1].push(
      hexZeroPad(address, 32),
    );
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

  private newWithdrawalFilter() {
    const newFilter: WithdrawalFilter = {
      address: this.tokenContract.address,
      topics: [this.withdrawalTopicId, []],
    };
    this.withdrawalFilters.push(newFilter);
  }

  private newDepositFilter() {
    const newFilter: DepositFilter = {
      address: this.tokenContract.address,
      topics: [this.depositTopicId, []],
    };
    this.depositFilters.push(newFilter);
  }
}

type TransferFilterFromTopics = [string, string[]];
type TransferFilterToTopics = [string, null, string[]];
type DepositFilterTopics = [string, string[]];
type WithdrawalFilterTopics = [string, string[]];

interface FromTransferFilter {
  address: string;
  topics: TransferFilterFromTopics;
}

interface ToTransferFilter {
  address: string;
  topics: TransferFilterToTopics;
}

interface DepositFilter {
  address: string;
  topics: DepositFilterTopics;
}

interface WithdrawalFilter {
  address: string;
  topics: WithdrawalFilterTopics;
}
