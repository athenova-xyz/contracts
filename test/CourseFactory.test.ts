import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("CourseFactory", function () {
  async function deployFactoryFixture() {
    const [owner, creator] = await hre.viem.getWalletClients();
    const courseFactory = await hre.viem.deployContract("CourseFactory", [
      owner.account.address, // platformAdmin
    ]);

    // Deploy unsupported token for testing failure case
    const unsupportedToken = await hre.viem.deployContract("ERC20Mock", [
      "Mock Token",
      "MOCK",
    ]);

    // Use owner as the crowdfundAddress for test purposes
    const investorNFT = await hre.viem.deployContract("InvestorNFT", [
      "Investor NFT",
      "INFT",
      owner.account.address,
      owner.account.address,
    ]);

    // BASE token addresses (read from contract constants)
    const USDC_BASE = (await courseFactory.read.USDC_BASE()) as `0x${string}`;
    const WETH_BASE = (await courseFactory.read.WETH_BASE()) as `0x${string}`;

    return {
      courseFactory,
      owner,
      creator,
      unsupportedToken,
      investorNFT,
      USDC_BASE,
      WETH_BASE,
    };
  }

  it("Should allow a user to create a new course", async function () {
    const { courseFactory, owner, USDC_BASE, investorNFT } = await loadFixture(
      deployFactoryFixture
    );

    const fundingGoal = 1000n;
    const duration = 30n * 24n * 60n * 60n; // 30 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    const txHash = await courseFactory.write.createCourse([
      USDC_BASE, // Use supported token
      fundingGoal,
      duration,
      investorNFT.address,
      milestoneDescriptions,
      milestonePayouts,
      owner.account.address, // platformAdmin
      owner.account.address, // platformWallet
      1000n, // platformShare (10%)
    ]);

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Fetch emitted events via viem-generated getter
    const events = await courseFactory.getEvents.CourseCreated(
      {},
      {
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      }
    );
    expect(events.length).to.equal(1);
    const evtArgs = events[0].args;
    expect(evtArgs.creator).to.not.be.undefined;
    expect(evtArgs.courseAddress).to.not.be.undefined;
    expect(getAddress(evtArgs.creator!)).to.equal(
      getAddress(owner.account.address)
    );
    expect(evtArgs.fundingGoal).to.equal(fundingGoal);

    // Verify the deployed course is stored (index 0)
    // For a public dynamic array Solidity creates a getter: deployedCourses(uint256) -> address
    const firstCourse = await courseFactory.read.deployedCourses([0n]);
    expect(getAddress(firstCourse)).to.equal(
      getAddress(evtArgs.courseAddress!)
    );
    expect(firstCourse).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Should revert if funding goal is zero", async function () {
    const { courseFactory, creator, WETH_BASE, investorNFT, owner } =
      await loadFixture(deployFactoryFixture);

    const fundingGoal = 0n;
    const duration = 7n * 24n * 60n * 60n; // 7 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [100n]; // Non-zero payout

    await expect(
      courseFactory.write.createCourse([
        WETH_BASE, // Use supported token
        fundingGoal,
        duration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts,
        owner.account.address, // platformAdmin
        owner.account.address, // platformWallet
        1000n, // platformShare (10%)
      ])
    ).to.be.rejectedWith("goal=0");
  });

  it("Should revert if deadline is not in the future", async function () {
    const { courseFactory, creator, USDC_BASE, investorNFT, owner } =
      await loadFixture(deployFactoryFixture);
    const fundingGoal = 1000n;
    const zeroDuration = 0n; // Duration of 0 should be rejected
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    // This should fail because duration=0 is not allowed
    await expect(
      courseFactory.write.createCourse([
        USDC_BASE, // Use supported token
        fundingGoal,
        zeroDuration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts,
        owner.account.address, // platformAdmin
        owner.account.address, // platformWallet
        1000n, // platformShare (10%)
      ])
    ).to.be.rejectedWith("duration=0");
  });

  it("Should revert if token is not supported on BASE", async function () {
    const { courseFactory, unsupportedToken, investorNFT, owner } =
      await loadFixture(deployFactoryFixture);

    const fundingGoal = 1000n;
    const duration = 7n * 24n * 60n * 60n; // 7 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    // This should fail because the token is not in the supported tokens list
    await expect(
      courseFactory.write.createCourse([
        unsupportedToken.address, // Use unsupported token
        fundingGoal,
        duration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts,
        owner.account.address, // platformAdmin
        owner.account.address, // platformWallet
        1000n, // platformShare (10%)
      ])
    ).to.be.rejectedWith("Token not supported on BASE");
  });

  it("Should allow creation with WETH token", async function () {
    const { courseFactory, owner, WETH_BASE, investorNFT } = await loadFixture(
      deployFactoryFixture
    );

    const fundingGoal = 1000n;
    const duration = 30n * 24n * 60n * 60n; // 30 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    const txHash = await courseFactory.write.createCourse([
      WETH_BASE, // Use WETH (supported token)
      fundingGoal,
      duration,
      investorNFT.address,
      milestoneDescriptions,
      milestonePayouts,
      owner.account.address, // platformAdmin
      owner.account.address, // platformWallet
      1000n, // platformShare (10%)
    ]);

    const publicClient = await hre.viem.getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify the course was created successfully by checking deployed courses array
    const deployedCourses = await courseFactory.read.deployedCourses([0n]); // First course in this test instance
    expect(deployedCourses).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Should allow platform admin to set supported token", async function () {
    const { courseFactory, owner, unsupportedToken } = await loadFixture(
      deployFactoryFixture
    );

    // Initially, the unsupported token should not be supported
    expect(
      await courseFactory.read.isTokenSupported([unsupportedToken.address])
    ).to.be.false;

    // Platform admin should be able to add support for the token
    const txHash = await courseFactory.write.setSupportedToken([
      unsupportedToken.address,
      true,
    ]);

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Check that the token is now supported
    expect(
      await courseFactory.read.isTokenSupported([unsupportedToken.address])
    ).to.be.true;

    // Check that the event was emitted
    const events = await courseFactory.getEvents.SupportedTokenUpdated(
      {},
      {
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      }
    );
    expect(events.length).to.equal(1);
    expect(getAddress(events[0].args.token!)).to.equal(
      getAddress(unsupportedToken.address)
    );
    expect(events[0].args.supported).to.be.true;
  });

  it("Should allow platform admin to remove supported token", async function () {
    const { courseFactory, owner, unsupportedToken } = await loadFixture(
      deployFactoryFixture
    );

    // First, add support for the token
    await courseFactory.write.setSupportedToken([
      unsupportedToken.address,
      true,
    ]);
    expect(
      await courseFactory.read.isTokenSupported([unsupportedToken.address])
    ).to.be.true;

    // Then remove support
    const txHash = await courseFactory.write.setSupportedToken([
      unsupportedToken.address,
      false,
    ]);

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Check that the token is no longer supported
    expect(
      await courseFactory.read.isTokenSupported([unsupportedToken.address])
    ).to.be.false;

    // Check that the event was emitted
    const events = await courseFactory.getEvents.SupportedTokenUpdated(
      {},
      {
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      }
    );
    expect(events.length).to.equal(1);
    expect(getAddress(events[0].args.token!)).to.equal(
      getAddress(unsupportedToken.address)
    );
    expect(events[0].args.supported).to.be.false;
  });

  it("Should revert if non-admin tries to set supported token", async function () {
    const { courseFactory, creator, unsupportedToken } = await loadFixture(
      deployFactoryFixture
    );

    // Non-admin (creator) should not be able to set supported tokens
    await expect(
      courseFactory.write.setSupportedToken([unsupportedToken.address, true], {
        account: creator.account,
      })
    ).to.be.rejectedWith("Only platform admin");
  });

  it("Should revert when trying to modify base tokens", async function () {
    const { courseFactory, USDC_BASE, WETH_BASE } = await loadFixture(
      deployFactoryFixture
    );

    // Should not be able to modify USDC_BASE
    await expect(
      courseFactory.write.setSupportedToken([USDC_BASE, false])
    ).to.be.rejectedWith("Cannot modify base tokens");

    // Should not be able to modify WETH_BASE
    await expect(
      courseFactory.write.setSupportedToken([WETH_BASE, false])
    ).to.be.rejectedWith("Cannot modify base tokens");
  });

  it("Should revert when trying to set zero address as supported token", async function () {
    const { courseFactory } = await loadFixture(deployFactoryFixture);

    await expect(
      courseFactory.write.setSupportedToken([
        "0x0000000000000000000000000000000000000000",
        true,
      ])
    ).to.be.rejectedWith("token addr zero");
  });

  it("Should allow course creation with newly supported token", async function () {
    const { courseFactory, owner, unsupportedToken, investorNFT } =
      await loadFixture(deployFactoryFixture);

    // Initially, creating a course with unsupported token should fail
    const fundingGoal = 1000n;
    const duration = 7n * 24n * 60n * 60n; // 7 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    await expect(
      courseFactory.write.createCourse([
        unsupportedToken.address,
        fundingGoal,
        duration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts,
        owner.account.address, // platformAdmin
        owner.account.address, // platformWallet
        1000n, // platformShare (10%)
      ])
    ).to.be.rejectedWith("Token not supported on BASE");

    // Add support for the token
    await courseFactory.write.setSupportedToken([
      unsupportedToken.address,
      true,
    ]);

    // Now course creation should succeed
    const txHash = await courseFactory.write.createCourse([
      unsupportedToken.address,
      fundingGoal,
      duration,
      investorNFT.address,
      milestoneDescriptions,
      milestonePayouts,
      owner.account.address, // platformAdmin
      owner.account.address, // platformWallet
      1000n, // platformShare (10%)
    ]);

    const publicClient = await hre.viem.getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify the course was created successfully
    const deployedCourses = await courseFactory.read.deployedCourses([0n]);
    expect(deployedCourses).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });
});
