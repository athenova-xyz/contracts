import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("CourseFactory", function () {
  async function deployFactoryFixture() {
    const [owner, creator] = await hre.viem.getWalletClients();
    const courseFactory = await hre.viem.deployContract("CourseFactory");
    return { courseFactory, owner, creator };
  }

  it("Should allow a user to create a new course", async function () {
    const { courseFactory, creator } = await loadFixture(deployFactoryFixture);

    const fundingGoal = 1000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

    const txHash = await courseFactory.write.createCourse([
      fundingGoal,
      deadline,
      creator.account.address,
    ]);

    const publicClient = await hre.viem.getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Fetch emitted events via viem-generated getter
    const events = await courseFactory.getEvents.CourseCreated();
    expect(events.length).to.equal(1);
    const evtArgs = events[0].args as any; // { courseAddress, creator, fundingGoal, deadline }
    expect(getAddress(evtArgs.creator)).to.equal(
      getAddress(creator.account.address)
    );
    expect(evtArgs.fundingGoal).to.equal(fundingGoal);

    // Verify the deployed course is stored (index 0)
    // For a public dynamic array Solidity creates a getter: deployedCourses(uint256) -> address
  const firstCourse = await courseFactory.read.deployedCourses([0n]);
  expect(getAddress(firstCourse)).to.equal(getAddress(evtArgs.courseAddress));
  expect(firstCourse).to.not.equal("0x0000000000000000000000000000000000000000");
  });
});
