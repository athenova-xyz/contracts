// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Crowdfund.sol";

/**
 * @title CourseFactory
 * @dev Deploys new Crowdfund contracts for course creators.
 */

contract CourseFactory {
    address[] public deployedCourses;
    
    // Supported tokens on BASE
    address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // USDC on BASE
    address public constant WETH_BASE = 0x4200000000000000000000000000000000000006; // Wrapped ETH on BASE
    
    mapping(address => bool) public supportedTokens;

    event CourseCreated(
        address indexed courseAddress,
        address indexed creator,
        uint256 fundingGoal,
        uint256 deadline
    );
    
    constructor() {
        // Initialize supported tokens
        supportedTokens[USDC_BASE] = true;
        supportedTokens[WETH_BASE] = true;
    }

    // Changed createCourse to accept investorNftAddress and milestone data
    function createCourse(
        address token,
        uint256 goal,
        uint256 duration,
        address investorNftAddress,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePayouts,
        address platformAdmin,
        address platformWallet,
        uint256 platformShareInit
    ) external returns (address) {
        // Input validation
        require(token != address(0), "token addr zero");
        require(supportedTokens[token], "Token not supported on BASE");
        require(goal > 0, "goal=0");
        require(duration > 0, "duration=0");
        require(investorNftAddress != address(0), "nft addr zero");
        require(milestoneDescriptions.length == milestonePayouts.length, "milestone len mismatch");
        require(milestonePayouts.length > 0, "no milestones");
        
        // Validate milestone payouts don't exceed goal
        uint256 totalPayout = 0;
        for (uint256 i = 0; i < milestonePayouts.length; i++) {
            totalPayout += milestonePayouts[i];
        }
        require(totalPayout <= goal, "payouts exceed goal");
        
        require(platformAdmin != address(0), "platform admin zero");
        require(platformWallet != address(0), "platform wallet zero");
        require(platformShareInit <= 10000, "platform share too high");

        Crowdfund newCourse = new Crowdfund(
            token,
            goal,
            duration,
            msg.sender, // creator is the caller, prevents spoofing
            investorNftAddress,
            milestoneDescriptions,
            milestonePayouts,
            platformAdmin,
            platformWallet,
            platformShareInit
        );

        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        uint256 deadline = block.timestamp + duration;
        emit CourseCreated(courseAddress, msg.sender, goal, deadline);

        return courseAddress;
    }
}
