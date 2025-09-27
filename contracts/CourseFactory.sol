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
    
    // Platform admin for governance functions
    address public immutable platformAdmin;

    event CourseCreated(
        address indexed courseAddress,
        address indexed creator,
        uint256 fundingGoal,
        uint256 deadline
    );
    
    event SupportedTokenUpdated(address indexed token, bool supported);
    
    constructor(address _platformAdmin) {
        require(_platformAdmin != address(0), "platform admin zero");
        platformAdmin = _platformAdmin;
    }

    modifier onlyPlatformAdmin() {
        require(msg.sender == platformAdmin, "Only platform admin");
        _;
    }

    // For future extensibility: add/remove supported tokens
    // Note: This example shows how extensibility could be added later
    // Currently, only USDC_BASE and WETH_BASE are supported via constants
    mapping(address => bool) private _additionalSupportedTokens;

    /**
     * @notice Check if a token is supported
     * @param token The token address to check
     * @return bool True if the token is supported
     */
    function isTokenSupported(address token) public view returns (bool) {
        return token == USDC_BASE || token == WETH_BASE  || _additionalSupportedTokens[token];
    }

    /**
     * @notice Add or remove support for additional tokens (governance function)
     * @param token The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(address token, bool supported) external onlyPlatformAdmin {
        require(token != address(0), "token addr zero");
        require(token != USDC_BASE && token != WETH_BASE, "Cannot modify base tokens");
        
        _additionalSupportedTokens[token] = supported;
        emit SupportedTokenUpdated(token, supported);
    }

    // Changed createCourse to accept investorNftAddress and milestone data
    function createCourse(
        address token,
        uint256 goal,
        uint256 duration,
        address investorNftAddress,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePayouts,
        address _platformAdmin,
        address platformWallet,
        uint256 platformShareInit
    ) external returns (address) {
        // Input validation
        require(token != address(0), "token addr zero");
        require(isTokenSupported(token), "Token not supported on BASE");
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
        
        require(_platformAdmin != address(0), "platform admin zero");
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
            _platformAdmin,
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
