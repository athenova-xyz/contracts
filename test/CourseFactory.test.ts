import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("CourseFactory", function () {
  async function deployFactoryFixture() {
    const [owner, creator] = await hre.viem.getWalletClients();
    const courseFactory = await hre.viem.deployContract("CourseFactory");
    const token = await hre.viem.deployContract("MockERC20", [
      "Mock Token",
      "MOCK",
    ]);
    const investorNFT = await hre.viem.deployContract("InvestorNFT", [
      "Investor NFT",
      "INFT",
    ]);
    return { courseFactory, owner, creator, token, investorNFT };
  }

  it("Should allow a user to create a new course", async function () {
    const { courseFactory, owner, token, investorNFT } = await loadFixture(deployFactoryFixture);

    const fundingGoal = 1000n;
    const duration = 30n * 24n * 60n * 60n; // 30 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    const txHash = await (courseFactory as any).write.createCourse([
      token.address,
      fundingGoal,
      duration,
      investorNFT.address,
      milestoneDescriptions,
      milestonePayouts,
    ]);

    const publicClient = await hre.viem.getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Fetch emitted events via viem-generated getter
    const events = await courseFactory.getEvents.CourseCreated();
    expect(events.length).to.equal(1);
    const evtArgs = events[0].args as any; // { courseAddress, creator, fundingGoal, deadline }
    expect(getAddress(evtArgs.creator)).to.equal(
      getAddress(owner.account.address)
    );
    expect(evtArgs.fundingGoal).to.equal(fundingGoal);

    // Verify the deployed course is stored (index 0)
    // For a public dynamic array Solidity creates a getter: deployedCourses(uint256) -> address
    const firstCourse = await courseFactory.read.deployedCourses([0n]);
    expect(getAddress(firstCourse)).to.equal(
      getAddress(evtArgs.courseAddress)
    );
    expect(firstCourse).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Should revert if funding goal is zero", async function () {
    const { courseFactory, creator, token, investorNFT } = await loadFixture(deployFactoryFixture);

    const fundingGoal = 0n;
    const duration = 7n * 24n * 60n * 60n; // 7 days in seconds
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [100n]; // Non-zero payout

    await expect(
      (courseFactory as any).write.createCourse([
        token.address,
        fundingGoal,
        duration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts
      ])
    ).to.be.rejectedWith("goal=0");
  });

  it("Should revert if deadline is not in the future", async function () {
    const { courseFactory, creator, token, investorNFT } = await loadFixture(deployFactoryFixture);
    const fundingGoal = 1000n;
    const zeroDuration = 0n; // Duration of 0 should be rejected
    const milestoneDescriptions = ["Complete project"];
    const milestonePayouts = [fundingGoal];

    // This should fail because duration=0 is not allowed
    await expect(
      (courseFactory as any).write.createCourse([
        token.address,
        fundingGoal,
        zeroDuration,
        investorNFT.address,
        milestoneDescriptions,
        milestonePayouts
      ])
    ).to.be.rejectedWith("duration=0");
  });
});