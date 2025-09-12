import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("InvestorNFT", function () {
  async function deployInvestorNFTFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const investorNFT = await hre.viem.deployContract("InvestorNFT", [
      "Athenova Investor Share",
      "AIS",
    ]);

    return { investorNFT, owner, otherAccount };
  }

  it("Should deploy with the correct owner and symbol", async function () {
    const { investorNFT, owner } = await loadFixture(deployInvestorNFTFixture);
    expect(await investorNFT.read.owner()).to.equal(
      getAddress(owner.account.address)
    );
    expect(await investorNFT.read.symbol()).to.equal("AIS");
  });

  it("Should allow the owner to mint a new token", async function () {
    const { investorNFT, otherAccount } = await loadFixture(
      deployInvestorNFTFixture
    );
    const tokenId = 1n; // Use BigInt for token IDs

    await investorNFT.write.safeMint([otherAccount.account.address, tokenId]);

    expect(await investorNFT.read.ownerOf([tokenId])).to.equal(
      getAddress(otherAccount.account.address)
    );
  });

  it("Should prevent non-owners from minting", async function () {
    const { investorNFT, owner, otherAccount } = await loadFixture(
      deployInvestorNFTFixture
    );
    const tokenId = 1n;

    // Connect to the contract with a different account (follow pattern from existing tests)
    const contractAsOther = await hre.viem.getContractAt(
      "InvestorNFT",
      investorNFT.address,
      { client: { wallet: otherAccount } }
    );

    // OpenZeppelin v4.9.6 Ownable uses the old error message
    await expect(
      contractAsOther.write.safeMint([owner.account.address, tokenId])
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
});
