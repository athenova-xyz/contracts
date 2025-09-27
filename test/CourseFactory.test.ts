import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("CourseFactory", function () {
  async function deployFactoryFixture() {
    const [owner, creator] = await hre.viem.getWalletClients();
    const courseFactory = await hre.viem.deployContract("CourseFactory");

    // Deploy unsupported token for testing failure case
    const unsupportedToken = await hre.viem.deployContract("ERC20Mock", [
      "Mock Token",
      "MOCK",
    ]);

    const investorNFT = await hre.viem.deployContract("InvestorNFT", [
      "Investor NFT",
      "INFT",
      owner.account.address,
    ]);

    // BASE token addresses (constants from the contract)
    const USDC_BASE =
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
    const WETH_BASE =
      "0x4200000000000000000000000000000000000006" as `0x${string}`;

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
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Fetch emitted events via viem-generated getter
    const events = await courseFactory.getEvents.CourseCreated();
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
});
