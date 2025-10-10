# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Running Tests and Deployment

### Running Tests

To run the tests for the smart contracts, use the following command:

```bash
npx hardhat test
```

This command executes all test files located in the `test/` directory. You can find the test configurations in `hardhat.config.ts`.

### Deploying Contracts

To deploy contracts, you can use the `scripts/deploy.ts` script. This script utilizes Hardhat's deployment capabilities.

To deploy to a local Hardhat network:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

To deploy to a specific network (e.g., Sepolia), ensure your `hardhat.config.ts` is configured for that network and use the `--network` flag:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

Replace `sepolia` with the name of your target network as defined in `hardhat.config.ts`.