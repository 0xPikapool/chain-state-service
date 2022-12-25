# Chain State Service

## Description

Service to keep redis hydrated with real-time chain-data required for the API Service to validate transaction validity.

Primarily, the service
1. Scrapes `Approval` events where a SettlementContract is the spender, and stores this information + the approve amounts in Redis
2. Scrapes `Transfer` events involving each 'Approver', and for addresses where a Transfer is detected checks their new balance and caches it in Redis

This way the API Service can ignore bids that would fail due to insufficient approval or balances without making any node requests (which would otherwise quickly become a bottleneck).

Build as a [Standalone Nest Application](https://docs.nestjs.com/standalone-applications).

## Redis Schema

- `{networkId}:{settlementContractId}:syncedBlock`: The block state Redis is currently synced to

- `{networkId}:{settlementContractId}:approvers`: Set of addresses which have approved the settlement contract

- `{networkId}:{settlementContractId}:{address}`: Map of approvers containing
  - `lastApproveValue`: The value of the last processed approval event for this address
  - `lastApproveBlock`: Last block the approval amt was updated
  - `lastBalanceValue`: The value of the last processed balance update for this address
  - `lastBalanceBlock`: Last block the address balance was updated

## Environment

1. `cp .env.sample .env`
2. Set Alchemy, Redis, and Settlement Contract details in `.env`.

## Development

### Install Deps

```bash
$ yarn install
```

### Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev
```

## Production

The application is Dockerized.

1. [Install Docker](https://docs.docker.com/get-docker/)
2. Make sure `.env` is up-to-date
3. Execute `docker-compose up`

## Multiple Production Environments

Each Chain State Service process supports just one settlement contract, and the current `docker-compose.yml` spawns just one Chain State Service container.

To support multiple SettlementContracts in the future, just add new services in the `docker-compose.yml` each with unique `.env` files.
