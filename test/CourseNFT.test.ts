import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("CourseNFT", function () {
  async function deployCourseNFTFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    // Use owner as the crowdfundAddress for test purposes
    const courseNFT = await hre.viem.deployContract("CourseNFT", [
      "Athenova Course Access",
      "ACA",
      owner.account.address,
      owner.account.address,
    ]);

    return { courseNFT, owner, otherAccount };
  }

  it("Should deploy with the correct owner and symbol", async function () {
    const { courseNFT, owner } = await loadFixture(deployCourseNFTFixture);
    expect(await courseNFT.read.owner()).to.equal(
      getAddress(owner.account.address)
    );
    expect(await courseNFT.read.symbol()).to.equal("ACA");
  });

  it("Should allow the owner to mint a new token", async function () {
    const { courseNFT, otherAccount } = await loadFixture(
      deployCourseNFTFixture
    );
    const tokenId = 1n;

    await courseNFT.write.safeMint([otherAccount.account.address, tokenId]);

    expect(await courseNFT.read.ownerOf([tokenId])).to.equal(
      getAddress(otherAccount.account.address)
    );
  });

  it("Should prevent non-owners from minting", async function () {
    const { courseNFT, owner, otherAccount } = await loadFixture(
      deployCourseNFTFixture
    );
    const tokenId = 1n;

    const contractAsOther = await hre.viem.getContractAt(
      "CourseNFT",
      courseNFT.address,
      { client: { wallet: otherAccount } }
    );

    await expect(
      contractAsOther.write.safeMint([owner.account.address, tokenId])
    ).to.be.rejectedWith("OwnableUnauthorizedAccount");
  });
});
