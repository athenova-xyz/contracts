import hre from "hardhat";

async function main() {
    const [deployer, creator] = await hre.viem.getWalletClients();
    console.log("Deploying with", deployer.account.address);

    // Deploy test token (or your real token) and mint if required
    const token = await hre.viem.deployContract("MockERC20", [
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

    // Deploy Crowdfund with investorNft address and milestones
    const fundingGoal = 1000000000000000000000n; // 1000 tokens (1000 * 10^18)
    const duration = 7n * 24n * 3600n; // 7 days

    // Define milestones for deployment
    const milestoneDescriptions = [
        "Complete project development and testing",
        "Deploy to production and launch"
    ];
    const milestonePayouts = [
        600000000000000000000n, // 600 tokens for milestone 1
        400000000000000000000n  // 400 tokens for milestone 2 (total = 1000)
    ];

    // Note: the contract allows total milestone payouts to be <= fundingGoal.
    // Any leftover funds (fundingGoal - sum(milestonePayouts)) will remain in
    // escrow and can be claimed by the creator through `claimFunds()` after
    // all milestones are released. Change milestones to exactly sum to the
    // fundingGoal if full allocation is required by your policy.

    const crowdfund = await hre.viem.deployContract("Crowdfund", [
        token.address,
        fundingGoal,
        duration,
        creator.account.address,
        investorNft.address,
        milestoneDescriptions,
        milestonePayouts
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
