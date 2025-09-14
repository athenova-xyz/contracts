import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("Crowdfund with InvestorNFT integration", function () {
  async function deployCrowdfundWithNFTFixture() {
    const [deployer, backer, attacker] = await hre.viem.getWalletClients();

  // Deploy ERC20Mock
  const token = await hre.viem.deployContract("ERC20Mock", [
      "TestToken",
      "TT",
    ]);

    // Deploy InvestorNFT
    const investorNft = await hre.viem.deployContract("InvestorNFT", [
      "Investor Share",
      "INV",
    ]);

    // Deploy Crowdfund
    const fundingGoal = 100000000000000000000n; // 100 * 10^18 (100 tokens)
    const duration = 3600n; // 1 hour
    const crowdfund = await hre.viem.deployContract("Crowdfund", [
      token.address,
      fundingGoal,
      duration,
      deployer.account.address,
      investorNft.address,
    ]);

    // Transfer ownership of InvestorNFT to Crowdfund
    await investorNft.write.transferOwnership([crowdfund.address]);

    // Mint tokens to backer
    await token.write.mint([backer.account.address, 1000000000000000000000n]); // 1000 tokens

    return { crowdfund, token, investorNft, deployer, backer, attacker, fundingGoal };
  }

  it("mints an Investor NFT on pledge and assigns unique tokenId", async function () {
    const { crowdfund, token, investorNft, backer } = await loadFixture(
      deployCrowdfundWithNFTFixture
    );

    // Backer approves and pledges
    const pledgeAmount = 10000000000000000000n; // 10 tokens
    await token.write.approve([crowdfund.address, pledgeAmount], {
      account: backer.account,
    });

    await crowdfund.write.pledge([pledgeAmount], {
      account: backer.account,
    });

    // Check NFT minted: first tokenId is 1
    expect(await investorNft.read.balanceOf([backer.account.address])).to.equal(1n);
    expect(getAddress(await investorNft.read.ownerOf([1n]))).to.equal(
      getAddress(backer.account.address)
    );
  });

  it("two pledges from same backer mint two distinct NFTs", async function () {
    const { crowdfund, token, investorNft, backer } = await loadFixture(
      deployCrowdfundWithNFTFixture
    );

    const a = 5000000000000000000n; // 5 tokens
    const b = 7000000000000000000n; // 7 tokens
    await token.write.approve([crowdfund.address, a + b], {
      account: backer.account,
    });

    await crowdfund.write.pledge([a], { account: backer.account });
    await crowdfund.write.pledge([b], { account: backer.account });

    expect(await investorNft.read.balanceOf([backer.account.address])).to.equal(2n);
    expect(getAddress(await investorNft.read.ownerOf([1n]))).to.equal(
      getAddress(backer.account.address)
    );
    expect(getAddress(await investorNft.read.ownerOf([2n]))).to.equal(
      getAddress(backer.account.address)
    );
  });

  it("prevents unauthorized accounts from calling safeMint directly", async function () {
    const { investorNft, attacker } = await loadFixture(
      deployCrowdfundWithNFTFixture
    );

    await expect(
      investorNft.write.safeMint([attacker.account.address, 999n], {
        account: attacker.account,
      })
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
});

/**
 * Fixture to deploy MockERC20 and Crowdfund (viem-based)
 */
async function deployCrowdfundFixture() {
  const [creator, backer, other] = await hre.viem.getWalletClients();

  // Deploy ERC20Mock
  const mockToken = await hre.viem.deployContract("ERC20Mock", [
    "Mock Token",
    "MOCK",
  ]);

  // Deploy InvestorNFT
  const investorNft = await hre.viem.deployContract("InvestorNFT", [
    "Investor Share",
    "INV",
  ]);

  // Deploy Crowdfund
  const fundingGoal = 1000000000000000000000n; // 1000 tokens
  const duration = 30n * 24n * 60n * 60n; // 30 days
  const crowdfund = await hre.viem.deployContract("Crowdfund", [
    mockToken.address,
    fundingGoal,
    duration,
    creator.account.address,
    investorNft.address,
  ]);

  // Transfer ownership of InvestorNFT to Crowdfund
  await investorNft.write.transferOwnership([crowdfund.address]);

  // Mint tokens to backer
  await mockToken.write.mint([backer.account.address, 1000000000000000000000000n]); // 1,000,000 tokens

  return { crowdfund, mockToken, investorNft, creator, backer, other, fundingGoal };
}

describe("Crowdfund", function () {
  it("Should allow pledging during funding period", async function () {
    const { crowdfund, mockToken, backer } = await loadFixture(
      deployCrowdfundFixture
    );
    const amount = 100000000000000000000n; // 100 tokens

    await mockToken.write.approve([crowdfund.address, amount], {
      account: backer.account,
    });
    await crowdfund.write.pledge([amount], { account: backer.account });

    const contrib = await crowdfund.read.contributions([backer.account.address]);
    expect(contrib.toString()).to.equal(amount.toString());
  });

  it("Should allow the creator to claim funds if successful", async function () {
    const { crowdfund, mockToken, investorNft, creator, backer, fundingGoal } =
      await loadFixture(deployCrowdfundFixture);

    // Backer pledges the full goal amount
    await mockToken.write.approve([crowdfund.address, fundingGoal], {
      account: backer.account,
    });
    await crowdfund.write.pledge([fundingGoal], { account: backer.account });

    // Move time forward past the deadline
    await time.increase(time.duration.days(31));

    // Creator claims the funds
    const initialCreatorBalance = await mockToken.read.balanceOf([
      creator.account.address,
    ]);
    await crowdfund.write.claimFunds({ account: creator.account });
    const finalCreatorBalance = await mockToken.read.balanceOf([
      creator.account.address,
    ]);

    expect((finalCreatorBalance - initialCreatorBalance).toString()).to.equal(
      fundingGoal.toString()
    );
    expect((await mockToken.read.balanceOf([crowdfund.address])).toString()).to.equal("0");
  });

  it("Should allow backers to get a refund if failed", async function () {
    const { crowdfund, mockToken, investorNft, backer } = await loadFixture(
      deployCrowdfundFixture
    );
    const pledgeAmount = 100000000000000000000n; // 100 tokens

    // Backer pledges, but not enough to meet the goal
    await mockToken.write.approve([crowdfund.address, pledgeAmount], {
      account: backer.account,
    });
    await crowdfund.write.pledge([pledgeAmount], { account: backer.account });

    // Move time forward past the deadline
    await time.increase(time.duration.days(31));

    const initialBackerBalance = await mockToken.read.balanceOf([
      backer.account.address,
    ]);
    await crowdfund.write.claimRefund({ account: backer.account });
    const finalBackerBalance = await mockToken.read.balanceOf([
      backer.account.address,
    ]);

    expect((finalBackerBalance - initialBackerBalance).toString()).to.equal(
      pledgeAmount.toString()
    );
    expect(
      (await crowdfund.read.contributions([backer.account.address])).toString()
    ).to.equal("0");
  });
});
