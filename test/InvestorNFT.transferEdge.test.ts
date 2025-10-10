import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { getAddress, zeroAddress } from 'viem'

describe('InvestorNFT - Transfer Edge Cases', function () {
  async function deployInvestorNFTFixture() {
    const [owner, addr1, addr2] = await hre.viem.getWalletClients()

    const investorNFT = await hre.viem.deployContract('InvestorNFT', [
      'Athenova Investor Share',
      'AIS',
      owner.account.address,
      owner.account.address, // Using owner as crowdfundAddress for tests
    ])

    // Mint a token to addr1 for transfer tests
    const tokenId = 1n
    await investorNFT.write.safeMint([addr1.account.address, tokenId])

    return { investorNFT, owner, addr1, addr2, tokenId }
  }

  it('Should reject transfer to the zero address', async function () {
    const { investorNFT, addr1, tokenId } = await loadFixture(
      deployInvestorNFTFixture,
    )

    const contractAsAddr1 = await hre.viem.getContractAt(
      'InvestorNFT',
      investorNFT.address,
      { client: { wallet: addr1 } },
    )

    await expect(
      contractAsAddr1.write.transferFrom([
        addr1.account.address,
        zeroAddress,
        tokenId,
      ]),
    ).to.be.rejectedWith('ERC721InvalidReceiver')
  })

  it('Should reject safeTransferFrom to the zero address', async function () {
    const { investorNFT, addr1, tokenId } = await loadFixture(
      deployInvestorNFTFixture,
    )

    const contractAsAddr1 = await hre.viem.getContractAt(
      'InvestorNFT',
      investorNFT.address,
      { client: { wallet: addr1 } },
    )

    await expect(
      contractAsAddr1.write.safeTransferFrom([
        addr1.account.address,
        zeroAddress,
        tokenId,
      ]),
    ).to.be.rejectedWith('ERC721InvalidReceiver')
  })

  it('Should reject transfer of a token not owned by the sender', async function () {
    const { investorNFT, addr1, addr2, tokenId } = await loadFixture(
      deployInvestorNFTFixture,
    )

    // addr2 tries to transfer a token owned by addr1
    const contractAsAddr2 = await hre.viem.getContractAt(
      'InvestorNFT',
      investorNFT.address,
      { client: { wallet: addr2 } },
    )

    await expect(
      contractAsAddr2.write.transferFrom([
        addr1.account.address,
        addr2.account.address,
        tokenId,
      ]),
    ).to.be.rejectedWith('ERC721InsufficientApproval')
  })

  it('Should reject safeTransferFrom of a token not owned by the sender', async function () {
    const { investorNFT, addr1, addr2, tokenId } = await loadFixture(
      deployInvestorNFTFixture,
    )

    // addr2 tries to safeTransferFrom a token owned by addr1
    const contractAsAddr2 = await hre.viem.getContractAt(
      'InvestorNFT',
      investorNFT.address,
      { client: { wallet: addr2 } },
    )

    await expect(
      contractAsAddr2.write.safeTransferFrom([
        addr1.account.address,
        addr2.account.address,
        tokenId,
      ]),
    ).to.be.rejectedWith('ERC721InsufficientApproval')
  })
})
