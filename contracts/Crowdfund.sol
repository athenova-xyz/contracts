// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Crowdfund
 * @dev Token-based crowdfunding contract with finalization logic.
 */
contract Crowdfund is ReentrancyGuard {
/**
 * @title Crowdfund
 * @dev Token-based crowdfunding contract with simple finalization logic.
 * Backers pledge ERC20 tokens toward a funding goal before a deadline.
 * If successful, creator can claim funds; otherwise backers can refund.
 */
    using SafeERC20 for IERC20;
    // Core campaign parameters
    IERC20 public immutable acceptedToken;
    address public immutable creator;
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline; // timestamp

    // Book-keeping
    uint256 public totalPledged;
    mapping(address => uint256) public contributions;
    bool public fundsClaimed;

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

    constructor(
        address _acceptedToken,
        uint256 _fundingGoal,
        uint256 _durationSeconds,
        address _creator
    ) {
        require(_acceptedToken != address(0), "token addr zero");
        require(_creator != address(0), "creator addr zero");
        require(_fundingGoal > 0, "goal=0");
        require(_durationSeconds > 0, "duration=0");

        acceptedToken = IERC20(_acceptedToken);
        fundingGoal = _fundingGoal;
        creator = _creator;
        deadline = block.timestamp + _durationSeconds;
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

    // Modifier to auto-update status on function entry
    modifier autoUpdateCampaignStatus() {
        _updateCampaignStatus();
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

        emit Pledged(msg.sender, actualReceived);
    }

    function claimFunds() external autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Successful, "Campaign was not successful");
        require(msg.sender == creator, "Only creator can claim");
        require(!fundsClaimed, "Funds already claimed");
        uint256 balance = acceptedToken.balanceOf(address(this));
        fundsClaimed = true; // effects before interactions to avoid reentrancy
        // use SafeERC20 to support non-standard tokens that do not return bool
        acceptedToken.safeTransfer(creator, balance);
        emit FundsClaimed(creator, balance);
    }

    function claimRefund() public autoUpdateCampaignStatus nonReentrant {
        require(currentState == State.Failed, "Campaign did not fail");
        uint256 amountToRefund = contributions[msg.sender];
        require(amountToRefund > 0, "No contribution to refund");
        contributions[msg.sender] = 0;
        // use SafeERC20 to support non-standard tokens that do not return bool
        acceptedToken.safeTransfer(msg.sender, amountToRefund);
        emit RefundClaimed(msg.sender, amountToRefund);
    }
}
