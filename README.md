# Chain State Service

## Description

Service to keep redis hydrated with real-time chain-data required for the API Service to check basic bid validity without hitting a node.

Primarily, the service
1. Scrapes `Approval` events where a SettlementContract is the spender, and stores this information + the approve amounts in Redis
2. Scrapes `Transfer` events involving each 'Approver', and uses those as a trigger to update approver balances and cache them in Redis

The service can be arbitrarily stopped/crashed and restarted safetly, it will pick up where it left off.

Build as a [Standalone Nest Application](https://docs.nestjs.com/standalone-applications).

## Redis

### Key Prefix

All keys are specific to a SettlementContract. 

Each key is prefixed with `{networkId}:{settlementContractId}`, where `settlementContractId` is the first 4 characters of the contract address.

### Key Schema

- `{prefix}:syncedBlock`: The block state Redis is currently synced to

- `{prefix}:approvers`: Set of addresses which have approved the settlement contract

- `{prefix}:{address}`: Map of approvers containing
  - `approveValue`: The value of the last processed approval event for this address
  - `approveBlock`: Last block the approval amt was updated
  - `balanceValue`: The value of the last processed balance update for this address
  - `balanceBlock`: Last block the address balance was updated

## Environment

1. `cp .env.sample .env`
2. Set Alchemy, Redis, and Settlement Contract details in `.env`.

## Development

### Install deps

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
3. Run `docker compose up`

## Multiple Production Environments

Each Chain State Service process supports just one settlement contract, and the current `docker-compose.yml` spawns just one Chain State Service container.

To support multiple SettlementContracts in the future, just add new services in the `docker-compose.yml` each with unique `.env` files.
