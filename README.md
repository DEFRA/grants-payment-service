# grants-payment-service

Grants Payment Service (GPS) processes farming grant payment schedules received from the
[farming-grants-agreements-api](https://github.com/DEFRA/farming-grants-agreements-api) via AWS SQS, stores them in
MongoDB, and submits daily batch payments to the Payment Hub for settlement. It also handles payment cancellations and
maintains an audit trail via AWS SNS.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [How it works](#how-it-works)
  - [Message consumers](#message-consumers)
  - [Daily payment processing](#daily-payment-processing)
  - [Stale lock cleanup](#stale-lock-cleanup)
  - [Audit events](#audit-events)
- [API endpoints](#api-endpoints)
  - [Test endpoints](#test-endpoints)
- [Configuration](#configuration)
- [Development helpers](#development-helpers)
  - [Testing the SQS queue](#testing-the-sqs-queue)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd grants-payment-service
nvm use
```

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

> **Note:** The `.env.example` sets `MONGO_URI=mongodb://localhost:27018/` because Docker Compose maps MongoDB to host
> port 27018. If you are running a local MongoDB instance directly, use port 27017 instead. MongoDB must be running as a
> replica set (`--replSet rs0`) for transactions and change streams to work.

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

This starts the server on `http://localhost:3009` with Nodemon watching for file changes.

For debug mode with an inspector on port 9229 (pauses execution until a debugger attaches):

```bash
npm run dev:debug
```

### Testing

To test the application run:

```bash
npm run test
```

To run tests in watch mode:

```bash
npm run test:watch
```

Contract tests (Pact) can be run separately:

```bash
# All contract tests
npm run test:contracts

# Consumer tests only
npm run test:contracts:consumer

# Provider tests only
npm run test:contracts:provider
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## How it works

### Message consumers

GPS consumes messages from two AWS SQS FIFO queues:

| Queue                           | Purpose                                                                                                                                               |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gps__sqs__create_payment.fifo` | Receives new payment schedules from the Agreements service. Creates a grant payment record in MongoDB with one or more scheduled payment instalments. |
| `gps__sqs__cancel_payment.fifo` | Receives cancellation requests. Cancels all pending payments for the given SBI and FRN where the due date is today or in the future.                  |

### Daily payment processing

A cron job runs daily (default `00:10 UTC`, configurable via `CRON_DAILY_PAYMENT_SCHEDULE`) and:

1. Queries MongoDB for all payments with today's due date and a `pending` status
2. Locks each payment using a conditional atomic update (compare-and-swap on payment status)
3. Transforms the payment data into the Payment Hub request format
4. Submits a batch of payments to the Payment Hub via HTTPS (authenticated with Azure Service Bus Shared Access Signature tokens)
5. Updates the payment status to `submitted` or `failed`
6. Publishes an audit event to SNS for each submission

### Stale lock cleanup

A second cron job runs daily (default `00:20 UTC`, configurable via `CRON_STALE_LOCKED_PAYMENT_CLEANUP_SCHEDULE`) and
marks any payments that have been in `locked` status for longer than `LOCKED_PAYMENT_TTL` (default 5 minutes) as
`failed`, preventing zombie locks from blocking the processing queue.

### Audit events

Key payment lifecycle changes are published to an SNS audit topic (`SNS_TOPIC_ARN_AUDIT`). Events
include SBI, FRN, invoice number, agreement number, and a correlation ID for tracing.

| Event                             | Trigger                                                                                | Action    |
| :-------------------------------- | :------------------------------------------------------------------------------------- | :-------- |
| `PAYMENT_HUB_REQUEST_SENT`        | Payment submitted to Payment Hub (successful or failed) during daily processing        | submitted |
| `GRANT_PAYMENT_CREATED`           | New payment schedule received via the `create_payment` SQS message                     | created   |
| `GRANT_PAYMENT_CANCELLED`         | Payment cancelled via the `cancel_payment` SQS message                                 | withdrawn |
| `GRANT_PAYMENT_STALE_LOCK_FAILED` | Payment stuck in `locked` beyond the TTL, marked failed by the stale lock cleanup cron | updated   |
| `GRANT_PAYMENTS_RESET_TO_PENDING` | Failed payment reset to `pending` by the resend-failed-payments startup job            | updated   |

## API endpoints

| Endpoint             | Description                                                                  |
| :------------------- | :--------------------------------------------------------------------------- |
| `GET: /health`       | Health check (includes MongoDB connection status and feature flags)          |
| `GET: /health/stats` | Database statistics (account counts, grant counts, payment counts by status) |

### Test endpoints

These are available when `ENABLE_TEST_ENDPOINTS=true` and are disabled in production via CDP environment
configuration. These endpoints can seed the database and trigger payment processing, so they must never be enabled in
production.

| Method | Endpoint                                    | Description                               |
| :----- | :------------------------------------------ | :---------------------------------------- |
| POST   | `/api/test/grant-payments`                  | Create a grant payment record             |
| GET    | `/api/test/grant-payments`                  | List all grant payments                   |
| GET    | `/api/test/grant-payments/{sbi}`            | Get payments by SBI                       |
| GET    | `/api/test/grant-payments/{sbi}/{fundCode}` | Get payments by SBI and fund code         |
| POST   | `/api/test/process-payments/{date?}`        | Manually trigger daily payment processing |
| GET    | `/api/test/daily-payments/{date?}`          | Get payments due on a given date          |
| POST   | `/api/test/populate-grant-payments`         | Seed database with sample payment data    |
| POST   | `/api/test/queue-message/{queueName?}`      | Publish a test message to an SQS queue    |

## Configuration

Configuration is managed with [Convict](https://github.com/mozilla/node-convict) and validated at startup. Key
environment variables:

| Variable                                     | Default                      | Description                                                                 |
| :------------------------------------------- | :--------------------------- | :-------------------------------------------------------------------------- |
| `PORT`                                       | `3009`                       | Server port                                                                 |
| `MONGO_URI`                                  | `mongodb://127.0.0.1:27017/` | MongoDB connection string                                                   |
| `MONGO_DATABASE`                             | `grants-payment-service`     | Database name                                                               |
| `QUEUE_URL`                                  | -                            | SQS URL for the create payment FIFO queue                                   |
| `CANCEL_PAYMENT_QUEUE_URL`                   | -                            | SQS URL for the cancel payment FIFO queue                                   |
| `SNS_TOPIC_ARN_AUDIT`                        | -                            | SNS topic ARN for audit events                                              |
| `ENABLE_PAYMENT_HUB`                         | `false`                      | Feature flag to enable Payment Hub submissions                              |
| `PAYMENT_HUB_URI`                            | `https://paymenthub/`        | Payment Hub base URL (placeholder default)                                  |
| `PAYMENT_HUB_SA_KEY_NAME`                    | `MyManagedAccessKey`         | Service bus shared access key name                                          |
| `PAYMENT_HUB_SA_KEY`                         | `my_key`                     | Service bus shared access key (secret -- override in deployed environments) |
| `PAYMENT_HUB_TTL`                            | `86400`                      | SAS token time-to-live in seconds                                           |
| `CRON_DAILY_PAYMENT_SCHEDULE`                | `10 0 * * *`                 | Cron expression for daily payment processing                                |
| `CRON_STALE_LOCKED_PAYMENT_CLEANUP_SCHEDULE` | `20 0 * * *`                 | Cron expression for stale lock cleanup                                      |
| `CRON_TIMEZONE`                              | `Europe/London`              | Timezone for cron schedules                                                 |
| `PAYMENT_PROCESSOR_MIN_BATCH_SIZE`           | `10`                         | Minimum payments per batch                                                  |
| `PAYMENT_PROCESSOR_MAX_BATCH_SIZE`           | `100`                        | Maximum payments per batch                                                  |
| `LOCKED_PAYMENT_TTL`                         | `300000`                     | Stale lock timeout in milliseconds (5 minutes)                              |
| `ENABLE_TEST_ENDPOINTS`                      | `true`                       | Enable test-only API endpoints                                              |
| `PAGE_LIMIT`                                 | `10`                         | Default pagination page size                                                |
| `LOG_LEVEL`                                  | `info`                       | Pino log level                                                              |

See [src/config/index.js](./src/config/index.js) for the full configuration schema.

## Development helpers

### Testing the SQS queue

Start the local Docker Compose environment (includes [Floci](https://github.com/hectorvent/floci), a lightweight
LocalStack alternative for mocking AWS services, and MongoDB):

> **Note:** Docker Compose exposes the service on port `3557` (not `3009`). When running outside Docker, `npm run dev`
> uses port `3009`.

```bash
docker compose up --build -d
```

You can monitor SQS queue depths with:

```bash
docker compose exec floci sh -lc 'awslocal sqs list-queues'
```

To peek at messages on a queue:

```bash
docker compose exec floci sh -lc '
  QURL=$(awslocal sqs get-queue-url \
    --queue-name gps__sqs__create_payment.fifo \
    --query QueueUrl --output text)
  awslocal sqs receive-message \
    --queue-url "$QURL" \
    --max-number-of-messages 10 \
    --wait-time-seconds 1
'
```

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher.

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Docker

### Development image

Build:

```bash
docker build --target development --no-cache --tag grants-payment-service:development .
```

### Production image

Build:

```bash
docker build --no-cache --tag grants-payment-service .
```

> **Note:** The service requires MongoDB, SQS, and SNS to function. Use Docker Compose (below) for a working local
> environment rather than running the container in isolation.

### Docker Compose

A local environment with:

- [Floci](https://github.com/hectorvent/floci) for mock AWS services (SQS, SNS, S3, Firehose) on port 4569
- MongoDB replica set on host port 27018
- This service on host port 3557

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of His Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
