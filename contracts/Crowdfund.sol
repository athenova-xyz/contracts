// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInvestorNFT {
    function safeMint(address to, uint256 tokenId) external;
}

interface ICourseNFT {
    function safeMint(address to, uint256 tokenId) external;
    function owner() external view returns (address);
}

struct Milestone {
    string description;
    uint256 payoutAmount;
    bool released;
    uint256 approvalVotes;
    mapping(address => bool) hasVoted;
}

/**
 * @title Crowdfund
 * @dev Token-based crowdfunding contract with finalization logic.
 */
contract Crowdfund is ReentrancyGuard {
    using SafeERC20 for IERC20;
    // Core campaign parameters
    IERC20 public immutable acceptedToken;
    address public immutable creator;
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline; // timestamp

    // Investor NFT contract and token id counter
    IInvestorNFT public investorNFT;
    uint256 private _nextTokenId;

    // Course NFT (for primary sales) and counters
    ICourseNFT public courseNFT;
    uint256 private _nextCourseTokenId;

    // Primary sale economics
    uint256 public coursePrice;
    // Shares are expressed in basis points (parts per 10,000)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public creatorShare; // e.g. 7000 = 70.00%
    uint256 public backerShare;  // e.g. 2000 = 20.00%
    uint256 public platformShare; // e.g. 1000 = 10.00%
    address public platformWallet;
    address public immutable platformAdmin;

    // Backer revenue accounting
    // totalBackerPool is the cumulative amount allocated for backers
    uint256 public totalBackerPool;
    // tracks how much each backer already withdrew from the backer pool
    mapping(address => uint256) public backerWithdrawn;
    // aggregate sum of all backer withdrawals to protect pool reserves
    uint256 public backerPaidOutTotal;

    // Book-keeping
    uint256 public totalPledged;
    mapping(address => uint256) public contributions;
    bool public fundsClaimed;

    // Milestone system
    Milestone[] private milestones;
    uint256 public totalMilestoneFunds;

    // Campaign state
    enum State {
        Funding,
        Successful,
        Failed
    }
    State public currentState = State.Funding;

    // Events
    event Pledged(address indexed backer, uint256 amount);
    event CampaignSuccessful(uint256 totalPledged);
    event CampaignFailed(uint256 totalPledged);
    event FundsClaimed(address indexed creator, uint256 amount);
    event RefundClaimed(address indexed backer, uint256 amount);
    event InvestorNftMinted(address indexed backer, uint256 tokenId);
    event MintFailed(address indexed backer, uint256 tokenId);
    event MilestoneVoted(address indexed voter, uint256 indexed milestoneIndex, uint256 voteWeight);
    event MilestoneFundsReleased(uint256 indexed milestoneIndex, uint256 amount);

    // Hardcoded platform admin and wallet
    address constant HARDCODED_PLATFORM = 0xC257274276a4E539741Ca11b590B9447B26A8051;

    // Modifier for platform admin only
    modifier onlyPlatformAdmin() {
        require(msg.sender == platformAdmin, "Only platform admin");
        _;
    }

    constructor(
        address _acceptedToken,
        uint256 _fundingGoal,
        uint256 _durationSeconds,
        address _creator,
        address _investorNftAddress,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestonePayouts
    ) {
        require(_acceptedToken != address(0), "token addr zero");
        require(_creator != address(0), "creator addr zero");
        require(_fundingGoal > 0, "goal=0");
        require(_durationSeconds > 0, "duration=0");
        require(_investorNftAddress != address(0), "nft addr zero");
        require(_milestoneDescriptions.length == _milestonePayouts.length, "milestone arrays length mismatch");
        require(_milestoneDescriptions.length > 0, "no milestones provided");

        acceptedToken = IERC20(_acceptedToken);
        fundingGoal = _fundingGoal;
        creator = _creator;
        deadline = block.timestamp + _durationSeconds;

        investorNFT = IInvestorNFT(_investorNftAddress);
        _nextTokenId = 1;

        // Default course-related values (can be set later if zero)
        _nextCourseTokenId = 1;

    platformAdmin = HARDCODED_PLATFORM;
    platformWallet = HARDCODED_PLATFORM;
    platformShare = 1000; // 10% in basis points

        // Initialize milestones
        uint256 totalPayouts = 0;
        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            require(_milestonePayouts[i] > 0, "milestone payout must be > 0");
            // ensure milestone has a non-empty human-readable description
            require(bytes(_milestoneDescriptions[i]).length > 0, "milestone description empty");
            totalPayouts += _milestonePayouts[i];
            
            milestones.push();
            Milestone storage milestone = milestones[i];
            milestone.description = _milestoneDescriptions[i];
            milestone.payoutAmount = _milestonePayouts[i];
            milestone.released = false;
            milestone.approvalVotes = 0;
        }
        
    // Allow totalPayouts to be <= funding goal. Any leftover funds after
    // milestone disbursements remain in escrow and can be claimed via the
    // normal `claimFunds()` flow once all milestones are released. If the
    // design requires full allocation of the funding goal to milestones,
    // change this to `totalPayouts == _fundingGoal`.
    require(totalPayouts <= _fundingGoal, "milestone payouts exceed funding goal");
        totalMilestoneFunds = totalPayouts;
    }

    // Internal helper to update campaign state based on deadline and goal
    function _updateCampaignStatus() internal {
        if (currentState == State.Funding && block.timestamp >= deadline) {
            if (totalPledged >= fundingGoal) {
                currentState = State.Successful;
                emit CampaignSuccessful(totalPledged);
            } else {
                currentState = State.Failed;
                emit CampaignFailed(totalPledged);
            }
        }
    }

    // Public function to trigger state transition after deadline
    function checkCampaignStatus() external {
        require(block.timestamp >= deadline, "Too early");
        _updateCampaignStatus();
    }

    /**
     * @notice Set course sale parameters. Only callable by the creator.
     * @param _courseNftAddress Address of the CourseNFT contract
     * @param _coursePrice Price in acceptedToken for a primary sale
     * @param _creatorShare Basis points for creator
     * @param _backerShare Basis points for backers
     * @param _platformShare Basis points for platform
     */
    function setCourseSaleParams(
        address _courseNftAddress,
        uint256 _coursePrice,
        uint256 _creatorShare,
        uint256 _backerShare,
        uint256 _platformShare
    ) external {
        require(msg.sender == creator, "Only creator");
        require(_courseNftAddress != address(0), "course nft zero");
        require(_creatorShare + _backerShare + _platformShare == FEE_DENOMINATOR, "Shares must sum to denominator");
        // Ensure the Crowdfund contract is the owner of the CourseNFT before enabling sales
        require(ICourseNFT(_courseNftAddress).owner() == address(this), "Crowdfund must own CourseNFT");

        courseNFT = ICourseNFT(_courseNftAddress);
        coursePrice = _coursePrice;
        creatorShare = _creatorShare;
        backerShare = _backerShare;
        platformShare = _platformShare;
    }

    /**
     * @notice Update the platform wallet. Only callable by platformAdmin.
     * @param newPlatformWallet The new platform wallet address
     */
    function setPlatformWallet(address newPlatformWallet) external onlyPlatformAdmin {
        require(newPlatformWallet != address(0), "platform wallet zero");
        platformWallet = newPlatformWallet;
    }

    /**
     * @notice Update the platform share (basis points). Only callable by platformAdmin.
     * @param newPlatformShare The new platform share in basis points (max 10000)
     */
    function setPlatformShare(uint256 newPlatformShare) external onlyPlatformAdmin {
        require(newPlatformShare <= FEE_DENOMINATOR, "share too high");
        require(creatorShare + backerShare + newPlatformShare <= FEE_DENOMINATOR, "shares exceed denominator");
        platformShare = newPlatformShare;
    }

    /**
     * @notice Purchase a course (primary sale). Buyer must approve coursePrice.
     */
    function purchaseCourse() external nonReentrant {
        require(coursePrice > 0, "Course not for sale");
        require(address(courseNFT) != address(0), "CourseNFT not set");

        // Transfer course price from buyer to this contract
        uint256 balanceBefore = acceptedToken.balanceOf(address(this));
        acceptedToken.safeTransferFrom(msg.sender, address(this), coursePrice);
        uint256 balanceAfter = acceptedToken.balanceOf(address(this));
        uint256 actualReceived = balanceAfter - balanceBefore;
        require(actualReceived == coursePrice, "Incorrect transferred amount");

        // Mint CourseNFT to buyer
        uint256 courseTokenId = _nextCourseTokenId;
        try courseNFT.safeMint(msg.sender, courseTokenId) {
            _nextCourseTokenId = courseTokenId + 1;
        } catch {
            // If minting fails, revert to avoid holding buyer funds without NFT
            revert("CourseNFT mint failed");
        }

        // Distribute revenue according to shares
        _distributeRevenue(actualReceived);
    }

    // Internal distribution: transfers creator and platform shares immediately,
    // allocates backer share to the backer pool for later withdrawal.
    function _distributeRevenue(uint256 amount) internal {
        if (amount == 0) return;
        uint256 creatorAmt = (amount * creatorShare) / FEE_DENOMINATOR;
        uint256 backerAmt = (amount * backerShare) / FEE_DENOMINATOR;
        uint256 platformAmt = (amount * platformShare) / FEE_DENOMINATOR;

        // Explicit dust handling so rounding behavior is deterministic.
        // Policy: allocate dust to backers (fairness). Change if platform should absorb dust.
        uint256 dust = amount - creatorAmt - backerAmt - platformAmt;
        if (dust > 0) {
            backerAmt += dust;
        }

        // Effects first: reserve backer allocation before external transfers
        if (backerAmt > 0) {
            totalBackerPool += backerAmt;
        }

        // Interactions: transfer creator and platform shares
        if (creatorAmt > 0) {
            acceptedToken.safeTransfer(creator, creatorAmt);
        }
        if (platformAmt > 0) {
            acceptedToken.safeTransfer(platformWallet, platformAmt);
        }
    }

    /**
     * @notice Withdraw a backer's accumulated share from the backer pool.
     * The entitlement is proportional to their contributions / totalPledged.
     */
    function withdrawBackerRevenue() external nonReentrant {
    require(totalBackerPool > 0, "No backer funds");
        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "No contribution");
    require(totalPledged > 0, "No pledges");

        // Calculate entitled amount based on current pool and contribution weight
        // entitlement = totalBackerPool * contributed / totalPledged - alreadyWithdrawn
        uint256 entitled = (totalBackerPool * contributed) / totalPledged;
        uint256 already = backerWithdrawn[msg.sender];
        if (entitled <= already) revert("Nothing to withdraw");

        uint256 payout = entitled - already;
        backerWithdrawn[msg.sender] = already + payout;
        // update aggregate paid out to keep liability accounting accurate
        backerPaidOutTotal += payout;

        // Transfer payout
        acceptedToken.safeTransfer(msg.sender, payout);
    }

    // Helper returns outstanding liability reserved for backers
    function _backerPoolLiability() internal view returns (uint256) {
        return totalBackerPool - backerPaidOutTotal;
    }

    // Modifier to auto-update status on function entry
    modifier autoUpdateCampaignStatus() {
        _updateCampaignStatus();
        _;
    }

    /**
     * @notice Pledge tokens toward the campaign while it is funding.
     * Caller must approve this contract to transfer `amount` tokens beforehand.
     * Note: Supports fee-on-transfer tokens by accounting based on the actual
     *       amount received by this contract (post-transfer balance delta).
     */
    function pledge(uint256 amount) external autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Funding, "Not funding");
        require(block.timestamp < deadline, "Past deadline");
        require(amount > 0, "amount=0");

        // Interactions first to measure actual received (supports FoT tokens)
        uint256 beforeBal = acceptedToken.balanceOf(address(this));
        acceptedToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBal = acceptedToken.balanceOf(address(this));
        uint256 actualReceived = afterBal - beforeBal;

        // Effects: account by actual received amount
        contributions[msg.sender] += actualReceived;
        totalPledged += actualReceived;

        // Mint unique Investor NFT to backer
        uint256 tokenId = _nextTokenId;
        try investorNFT.safeMint(msg.sender, tokenId) {
            _nextTokenId = tokenId + 1;
            emit InvestorNftMinted(msg.sender, tokenId);
        } catch {
            // Log minting failure but don't block pledge
            emit MintFailed(msg.sender, tokenId);
        }

        emit Pledged(msg.sender, actualReceived);
    }

    /**
     * @notice Vote on a milestone with weight based on contribution amount.
     * Only backers who have contributed can vote, and only once per milestone.
     */
    function voteOnMilestone(uint256 _milestoneIndex) external autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Successful, "Campaign must be successful to vote");
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        require(contributions[msg.sender] > 0, "Must be a backer to vote");
        require(!milestones[_milestoneIndex].hasVoted[msg.sender], "Already voted on this milestone");
        require(!milestones[_milestoneIndex].released, "Milestone already released");

        uint256 voteWeight = contributions[msg.sender];
        milestones[_milestoneIndex].approvalVotes += voteWeight;
        milestones[_milestoneIndex].hasVoted[msg.sender] = true;

        emit MilestoneVoted(msg.sender, _milestoneIndex, voteWeight);
    }

    /**
     * @notice Release milestone funds to creator if majority threshold is met.
     * Only creator can call this function.
     */
    function releaseMilestoneFunds(uint256 _milestoneIndex) external autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Successful, "Campaign must be successful");
        require(msg.sender == creator, "Only creator can release funds");
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        require(!milestones[_milestoneIndex].released, "Milestone already released");

        Milestone storage milestone = milestones[_milestoneIndex];
        
        // Check if majority threshold (> 50% of totalPledged) is met
        require(milestone.approvalVotes > totalPledged / 2, "Insufficient votes for release");

        milestone.released = true;
        uint256 payoutAmount = milestone.payoutAmount;

    // Ensure we do not drain funds reserved for backers
    uint256 liability = _backerPoolLiability();
    uint256 bal = acceptedToken.balanceOf(address(this));
    require(bal >= liability + payoutAmount, "Insufficient free funds (reserved for backers)");

    // Transfer milestone funds to creator
    acceptedToken.safeTransfer(creator, payoutAmount);
        
        emit MilestoneFundsReleased(_milestoneIndex, payoutAmount);
    }

    /**
     * @notice Get milestone information (excluding the mapping)
     */
    function getMilestone(uint256 _milestoneIndex) external view returns (
        string memory description,
        uint256 payoutAmount,
        bool released,
        uint256 approvalVotes
    ) {
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        Milestone storage milestone = milestones[_milestoneIndex];
        return (milestone.description, milestone.payoutAmount, milestone.released, milestone.approvalVotes);
    }

    /**
     * @notice Check if an address has voted on a specific milestone
     */
    function hasVotedOnMilestone(uint256 _milestoneIndex, address voter) external view returns (bool) {
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        return milestones[_milestoneIndex].hasVoted[voter];
    }

    /**
     * @notice Get the total number of milestones
     */
    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function claimFunds() external autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Successful, "Campaign was not successful");
        require(msg.sender == creator, "Only creator can claim");
        require(!fundsClaimed, "Funds already claimed");
        
        // If milestones exist, only allow claiming remaining funds after all milestones are released
        if (milestones.length > 0) {
            for (uint256 i = 0; i < milestones.length; i++) {
                require(milestones[i].released, "All milestones must be released first");
            }
        }
        
        uint256 bal = acceptedToken.balanceOf(address(this));
        uint256 liability = _backerPoolLiability();
        require(bal > liability, "All funds reserved for backers");

        uint256 claimable = bal - liability;

        fundsClaimed = true; // effects before interactions to avoid reentrancy
        // use SafeERC20 to support non-standard tokens that do not return bool
        acceptedToken.safeTransfer(creator, claimable);
        emit FundsClaimed(creator, claimable);
    }

    function claimRefund() public autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Failed, "Campaign did not fail");
        uint256 amountToRefund = contributions[msg.sender];
        require(amountToRefund > 0, "No contribution to refund");
        // Ensure refunds do not reduce contract balance below backers' outstanding liability
        uint256 outstandingBackerLiability = _backerPoolLiability(); // totalBackerPool - backerPaidOutTotal
        uint256 bal = acceptedToken.balanceOf(address(this));
        // require that after refunding, contract still holds at least the outstanding liability
        require(bal >= outstandingBackerLiability + amountToRefund, "Refund would impair backer pool");

        contributions[msg.sender] = 0;
        // use SafeERC20 to support non-standard tokens that do not return bool
        acceptedToken.safeTransfer(msg.sender, amountToRefund);
        emit RefundClaimed(msg.sender, amountToRefund);
    }
}
