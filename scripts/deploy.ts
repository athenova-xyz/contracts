import hre from "hardhat";

async function main() {
    const [deployer, creator] = await hre.viem.getWalletClients();
    console.log("Deploying with", deployer.account.address);

    // Deploy test token (or your real token) and mint if required
    const token = await hre.viem.deployContract("ERC20Mock", [
        "TestToken",
        "TT"
    ]);
    console.log("Token deployed:", token.address);

    // Deploy InvestorNFT
    const investorNft = await hre.viem.deployContract("InvestorNFT", [
        "Investor Share",
        "INV"
    ]);
    console.log("InvestorNFT:", investorNft.address);

    // Deploy Crowdfund with investorNft address
    const fundingGoal = 1000000000000000000000n; // 1000 tokens (1000 * 10^18)
    const duration = 7n * 24n * 3600n; // 7 days
    const crowdfund = await hre.viem.deployContract("Crowdfund", [
        token.address,
        fundingGoal,
        duration,
        creator.account.address,
        investorNft.address
    ]);
    console.log("Crowdfund deployed:", crowdfund.address);

    // Transfer ownership of InvestorNFT to Crowdfund so only Crowdfund can mint
    await investorNft.write.transferOwnership([crowdfund.address]);

    console.log("Deployed:", {
        token: token.address,
        investorNft: investorNft.address,
        crowdfund: crowdfund.address,
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
