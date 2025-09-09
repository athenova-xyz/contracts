import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseUnits } from "viem";

/**
 * Fixture to deploy MockERC20 and Crowdfund
 */
async function deployCrowdfundFixture() {
  const [creator, backer, other] = await hre.viem.getWalletClients();

  const mockToken = await hre.viem.deployContract("MockERC20", [
    "Mock Token",
    "MOCK",
  ]);

  // Mint tokens to backer
  const mockAsCreator = await hre.viem.getContractAt("MockERC20", mockToken.address, {
    client: { wallet: creator },
  });
  const initialMint = parseUnits("1000000", 18);
  await mockAsCreator.write.mint([backer.account.address, initialMint]);

  const fundingGoal = parseUnits("1000", 18);
  const duration = 30n * 24n * 60n * 60n; // 30 days

  const crowdfund = await hre.viem.deployContract("Crowdfund", [
    mockToken.address,
    fundingGoal,
    duration,
    creator.account.address,
  ]);

  return { crowdfund, mockToken, creator, backer, other, fundingGoal };
}

describe("Crowdfund", function () {
  it("Should allow pledging during funding period", async function () {
    const { crowdfund, mockToken, backer } = await loadFixture(
      deployCrowdfundFixture
    );
  const amount = parseUnits("100", 18);

    const backerToken = await hre.viem.getContractAt("MockERC20", mockToken.address, {
      client: { wallet: backer },
    });
    await backerToken.write.approve([crowdfund.address, amount]);

    const backerCrowdfund = await hre.viem.getContractAt("Crowdfund", crowdfund.address, {
      client: { wallet: backer },
    });
    await backerCrowdfund.write.pledge([amount]);

    const contrib = await crowdfund.read.contributions([backer.account.address]);
    expect(contrib).to.equal(amount);
  });

  it("Should allow the creator to claim funds if successful", async function () {
    const { crowdfund, mockToken, creator, backer, fundingGoal } =
      await loadFixture(deployCrowdfundFixture);

    // Backer pledges the full goal amount
    const backerMockToken = await hre.viem.getContractAt(
      "MockERC20",
      mockToken.address, { client: { wallet: backer } }
    );
    await backerMockToken.write.approve([crowdfund.address, fundingGoal]);
    
    const backerCrowdfund = await hre.viem.getContractAt(
      "Crowdfund",
      crowdfund.address, { client: { wallet: backer } }
    );
    await backerCrowdfund.write.pledge([fundingGoal]);

    // Move time forward past the deadline
    await time.increase(time.duration.days(31));

    const creatorCrowdfund = await hre.viem.getContractAt(
      "Crowdfund",
      crowdfund.address, { client: { wallet: creator } }
    );

    // Creator claims the funds
    const initialCreatorBalance = await mockToken.read.balanceOf([creator.account.address]);
    await creatorCrowdfund.write.claimFunds();
    
  const finalCreatorBalance = await mockToken.read.balanceOf([creator.account.address]);
  expect(finalCreatorBalance).to.equal(initialCreatorBalance + fundingGoal);
    expect(await mockToken.read.balanceOf([crowdfund.address])).to.equal(0n);
  });

  it("Should allow backers to get a refund if failed", async function () {
    const { crowdfund, mockToken, backer } = await loadFixture(
      deployCrowdfundFixture
    );
  const pledgeAmount = parseUnits("100", 18);

    // Backer pledges, but not enough to meet the goal
    const backerMockToken = await hre.viem.getContractAt(
      "MockERC20",
      mockToken.address, { client: { wallet: backer } }
    );
    await backerMockToken.write.approve([crowdfund.address, pledgeAmount]);

    const backerCrowdfund = await hre.viem.getContractAt(
      "Crowdfund",
  crowdfund.address, { client: { wallet: backer } }
    );
    await backerCrowdfund.write.pledge([pledgeAmount]);

    // Move time forward past the deadline
    await time.increase(time.duration.days(31));

    const initialBackerBalance = await mockToken.read.balanceOf([backer.account.address]);
    await backerCrowdfund.write.refund();
    const finalBackerBalance = await mockToken.read.balanceOf([backer.account.address]);

    expect(finalBackerBalance).to.equal(initialBackerBalance + pledgeAmount);
    expect(await crowdfund.read.contributions([backer.account.address])).to.equal(0n);
  });
});
