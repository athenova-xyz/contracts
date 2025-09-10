// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Crowdfund
 * @dev Token-based crowdfunding contract with simple finalization logic.
 * Backers pledge ERC20 tokens toward a funding goal before a deadline.
 * If successful, creator can claim funds; otherwise backers can refund.
 */
contract Crowdfund {
    // Core campaign parameters
    IERC20 public immutable acceptedToken;
    address public immutable creator;
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline; // timestamp

    // Book-keeping
    uint256 public raisedAmount;
    mapping(address => uint256) public contributions;
    bool public fundsClaimed;

    // Campaign state
    enum State {
        Funding,
        Successful,
        Failed
    }

    State public currentState = State.Funding;

    /**
     * @param _acceptedToken ERC20 token accepted for pledges
     * @param _fundingGoal Minimum amount required for success
     * @param _durationSeconds Duration in seconds for the campaign
     * @param _creator Address that can claim funds on success
     */
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

    // Add this modifier
    modifier checkCampaignStatus() {
        if (currentState == State.Funding) {
            if (block.timestamp >= deadline) {
                currentState = raisedAmount >= fundingGoal
                    ? State.Successful
                    : State.Failed;
            }
        }
        _;
    }

    /**
     * @notice Pledge tokens toward the campaign while it is funding.
     * Caller must approve this contract to transfer `amount` tokens beforehand.
     */
    function pledge(uint256 amount) external checkCampaignStatus {
        require(currentState == State.Funding, "Not funding");
        require(block.timestamp < deadline, "Past deadline");
        require(amount > 0, "amount=0");

        // Effects first
        contributions[msg.sender] += amount;
        raisedAmount += amount;

        // Interactions
        bool ok = acceptedToken.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
    }

    // Add this function
    event FundsClaimed(address indexed creator, uint256 amount);

    function claimFunds() external checkCampaignStatus {
        require(currentState == State.Successful, "Campaign was not successful");
        require(msg.sender == creator, "Only creator can claim");
        require(!fundsClaimed, "Funds already claimed");

        uint256 balance = acceptedToken.balanceOf(address(this));
        fundsClaimed = true; // effects before interactions to avoid reentrancy
        bool sent = acceptedToken.transfer(creator, balance);
        require(sent, "Token transfer failed");
        emit FundsClaimed(creator, balance);
    }

    // Add this function
    function refund() external checkCampaignStatus {
        require(currentState == State.Failed, "Campaign did not fail");

        uint256 amountToRefund = contributions[msg.sender];
        require(amountToRefund > 0, "No contribution to refund");

        contributions[msg.sender] = 0;
        bool sent = acceptedToken.transfer(msg.sender, amountToRefund);
        require(sent, "Token transfer failed");
    }
}
