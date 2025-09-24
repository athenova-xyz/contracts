import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("Primary Course Sales and Backer Revenue Distribution", function () {
    async function deployCourseSalesFixture() {
        const [creator, backer1, backer2, buyer1, buyer2, platform] = await hre.viem.getWalletClients();

        // Deploy ERC20Mock
        const token = await hre.viem.deployContract("ERC20Mock", ["Mock Token", "MOCK"]);

        // Deploy CourseNFT and InvestorNFT
        const courseNFT = await hre.viem.deployContract("CourseNFT", ["Athenova Course Access", "ACA", creator.account.address]);
        const investorNft = await hre.viem.deployContract("InvestorNFT", ["Investor Share", "INV", creator.account.address]);

        // Deploy Crowdfund
        const fundingGoal = 1000000000000000000000n; // 1000 tokens
        const duration = 30n * 24n * 60n * 60n; // 30 days
        const milestoneDescriptions = ["Complete project"];
        const milestonePayouts = [fundingGoal];
        const crowdfund = await hre.viem.deployContract("Crowdfund", [
            token.address,
            fundingGoal,
            duration,
            creator.account.address,
            investorNft.address,
            milestoneDescriptions,
            milestonePayouts,
        ]);

        // Transfer ownership of NFTs to Crowdfund where required
        await investorNft.write.transferOwnership([crowdfund.address]);
        await courseNFT.write.transferOwnership([crowdfund.address]);

        // Set course sale params: 70% creator, 20% backers, 10% platform
        const coursePrice = 1000000000000000000n; // 1 token
        const creatorShare = 7000n;
        const backerShare = 2000n;
        const platformShare = 1000n;

        await crowdfund.write.setCourseSaleParams([
            courseNFT.address,
            coursePrice,
            creatorShare,
            backerShare,
            platformShare,
            platform.account.address,
        ], { account: creator.account });

        // Mint tokens to participants
        const largeMint = 1000000000000000000000000n; // plenty
        await token.write.mint([backer1.account.address, largeMint]);
        await token.write.mint([backer2.account.address, largeMint]);
        await token.write.mint([buyer1.account.address, largeMint]);
        await token.write.mint([buyer2.account.address, largeMint]);

        return { crowdfund, token, courseNFT, investorNft, creator, backer1, backer2, buyer1, buyer2, platform, coursePrice, creatorShare, backerShare, platformShare };
    }

    it("buyer receives CourseNFT and revenue is split correctly on purchase", async function () {
        const { crowdfund, token, courseNFT, creator, buyer1, platform, coursePrice, creatorShare, backerShare, platformShare } = await loadFixture(deployCourseSalesFixture);

        // No backers yet: backerPool should be zero before purchase
        const beforePool = await crowdfund.read.totalBackerPool();
        expect(beforePool).to.equal(0n);

        // Buyer approves and purchases course
        await token.write.approve([crowdfund.address, coursePrice], { account: buyer1.account });
        const creatorBalBefore = await token.read.balanceOf([creator.account.address]);
        const platformBalBefore = await token.read.balanceOf([platform.account.address]);

        await crowdfund.write.purchaseCourse({ account: buyer1.account });

        // Check CourseNFT minted (first course token id is 1)
        expect(getAddress(await courseNFT.read.ownerOf([1n]))).to.equal(getAddress(buyer1.account.address));

        // Compute expected splits (dust to backers)
        const creatorAmt = (coursePrice * creatorShare) / 10000n;
        const platformAmt = (coursePrice * platformShare) / 10000n;
        let backerAmt = (coursePrice * backerShare) / 10000n;
        const dust = coursePrice - creatorAmt - backerAmt - platformAmt;
        if (dust > 0n) backerAmt += dust;

        const creatorBalAfter = await token.read.balanceOf([creator.account.address]);
        const platformBalAfter = await token.read.balanceOf([platform.account.address]);

        expect(creatorBalAfter - creatorBalBefore).to.equal(creatorAmt);
        expect(platformBalAfter - platformBalBefore).to.equal(platformAmt);

        // Backer pool should have increased by backerAmt
        const poolAfter = await crowdfund.read.totalBackerPool();
        expect(poolAfter).to.equal(backerAmt);
    });

    it("backers can withdraw proportional share after multiple purchases and balances update correctly", async function () {
        const { crowdfund, token, creator, backer1, backer2, buyer1, buyer2, coursePrice, creatorShare, backerShare, platformShare } = await loadFixture(deployCourseSalesFixture);

        // Two backers pledge different amounts
        const pledge1 = 10000000000000000000n; // 10 tokens
        const pledge2 = 5000000000000000000n; // 5 tokens

        await token.write.approve([crowdfund.address, pledge1], { account: backer1.account });
        await crowdfund.write.pledge([pledge1], { account: backer1.account });

        await token.write.approve([crowdfund.address, pledge2], { account: backer2.account });
        await crowdfund.write.pledge([pledge2], { account: backer2.account });

        // Two buyers purchase courses
        const purchases = 3; // perform 3 purchases across buyers
        for (let i = 0; i < purchases; i++) {
            const buyer = i % 2 === 0 ? buyer1 : buyer2;
            await token.write.approve([crowdfund.address, coursePrice], { account: buyer.account });
            await crowdfund.write.purchaseCourse({ account: buyer.account });
        }

        // Compute expected total backer pool after purchases
        const singleBackerAmt = (coursePrice * backerShare) / 10000n;
        const singleCreatorAmt = (coursePrice * creatorShare) / 10000n;
        const singlePlatformAmt = (coursePrice * platformShare) / 10000n;
        const singleDust = coursePrice - singleCreatorAmt - singleBackerAmt - singlePlatformAmt;
        const perSaleBacker = singleBackerAmt + (singleDust > 0n ? singleDust : 0n);
        const expectedPool = perSaleBacker * BigInt(purchases);

        const pool = await crowdfund.read.totalBackerPool();
        expect(pool).to.equal(expectedPool);

        // Now calculate each backer's entitlement and withdraw
        const totalPledged = await crowdfund.read.totalPledged();
        const backer1Contrib = await crowdfund.read.contributions([backer1.account.address]);
        const backer2Contrib = await crowdfund.read.contributions([backer2.account.address]);

        // entitlement = totalBackerPool * contributed / totalPledged
        const entitled1 = (pool * backer1Contrib) / totalPledged;
        const entitled2 = (pool * backer2Contrib) / totalPledged;

        const before1 = await token.read.balanceOf([backer1.account.address]);
        const before2 = await token.read.balanceOf([backer2.account.address]);

        // backer1 withdraws
        await crowdfund.write.withdrawBackerRevenue({ account: backer1.account });
        const after1 = await token.read.balanceOf([backer1.account.address]);
        expect(after1 - before1).to.equal(entitled1);

        // backer1 second withdrawal should revert (nothing left)
        await expect(crowdfund.write.withdrawBackerRevenue({ account: backer1.account })).to.be.rejectedWith("Nothing to withdraw");

        // backer2 withdraws
        await crowdfund.write.withdrawBackerRevenue({ account: backer2.account });
        const after2 = await token.read.balanceOf([backer2.account.address]);
        expect(after2 - before2).to.equal(entitled2);

        // After withdrawal their claimable should be zero
        const already1 = await crowdfund.read.backerWithdrawn([backer1.account.address]);
        const already2 = await crowdfund.read.backerWithdrawn([backer2.account.address]);
        expect(already1).to.equal(entitled1);
        expect(already2).to.equal(entitled2);
    });
});
