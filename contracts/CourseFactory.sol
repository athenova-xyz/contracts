// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Crowdfund.sol";

/**
 * @title CourseFactory
 * @dev Deploys new Crowdfund contracts for course creators.
 */


/**
 * @title CourseFactory
 * @dev Deploys new Crowdfund contracts for course creators and manages supported tokens.
 *      Allows platform admin to add/remove supported tokens for funding courses.
 */
contract CourseFactory {
    /**
     * @notice Array of all deployed Crowdfund course contract addresses
     */
    address[] public deployedCourses;

    /**
     * @notice USDC token address on BASE chain
     */
    address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // USDC on BASE

    /**
     * @notice Wrapped ETH token address on BASE chain
     */
    address public constant WETH_BASE = 0x4200000000000000000000000000000000000006; // Wrapped ETH on BASE

    /**
     * @notice Platform admin address for governance functions
     * @dev Set once at deployment, immutable
     */
    address public immutable platformAdmin;

    /**
     * @notice Emitted when a new Crowdfund course contract is created
     * @param courseAddress The address of the newly created Crowdfund contract
     * @param creator The address of the course creator
     * @param fundingGoal The funding goal for the course
     * @param deadline The deadline timestamp for the course funding
     */
    event CourseCreated(
        address indexed courseAddress,
        address indexed creator,
        uint256 fundingGoal,
        uint256 deadline
    );

    /**
     * @notice Emitted when support for a token is added or removed
     * @param token The token address
     * @param supported True if the token is now supported, false otherwise
     */
    event SupportedTokenUpdated(address indexed token, bool supported);

    /**
     * @notice Initializes the CourseFactory contract
     * @param _platformAdmin The address of the platform admin
     */
    constructor(address _platformAdmin) {
        require(_platformAdmin != address(0), "platform admin zero");
        platformAdmin = _platformAdmin;
    }

    /**
     * @notice Restricts function to only be callable by the platform admin
     */
    modifier onlyPlatformAdmin() {
        require(msg.sender == platformAdmin, "Only platform admin");
        _;
    }

    /**
     * @dev Mapping for additional supported tokens (besides USDC_BASE and WETH_BASE)
     *      Only modifiable by platform admin
     */
    mapping(address => bool) private _additionalSupportedTokens;

    /**
     * @notice Check if a token is supported for course funding
     * @param token The token address to check
     * @return bool True if the token is supported
     */
    function isTokenSupported(address token) public view returns (bool) {
        return token == USDC_BASE || token == WETH_BASE  || _additionalSupportedTokens[token];
    }

    /**
     * @notice Add or remove support for additional tokens (governance function)
     * @dev Cannot modify support for USDC_BASE or WETH_BASE
     * @param token The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(address token, bool supported) external onlyPlatformAdmin {
        require(token != address(0), "token addr zero");
        require(token != USDC_BASE && token != WETH_BASE, "Cannot modify base tokens");

        _additionalSupportedTokens[token] = supported;
        emit SupportedTokenUpdated(token, supported);
    }

    /**
     * @notice Deploy a new Crowdfund contract for a course
     * @dev Validates input and milestone payouts, then deploys Crowdfund
     * @param token The funding token address
     * @param goal The funding goal amount
     * @param duration The funding duration in seconds
     * @param investorNftAddress The address of the InvestorNFT contract
     * @param milestoneDescriptions Array of milestone descriptions
     * @param milestonePayouts Array of milestone payout amounts
     * @param _platformAdmin The platform admin address for the Crowdfund contract
     * @param platformWallet The platform wallet address for fee collection
     * @param platformShareInit The initial platform share (basis points, max 10000)
     * @return address The address of the newly deployed Crowdfund contract
     */
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

        // Deploy new Crowdfund contract
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
