// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Crowdfund.sol";

/**
 * @title CourseFactory
 * @dev Deploys new Crowdfund contracts for course creators.
 */
contract CourseFactory {
    address[] public deployedCourses;

    event CourseCreated(
        address indexed courseAddress,
        address indexed creator,
        uint256 fundingGoal,
        uint256 deadline
    );

    // Option A: if you want the factory to store a default InvestorNFT address,
    // uncomment the following and set it in the factory constructor:
    // address public investorNftDefault;
    //
    // constructor(address _investorNftDefault) {
    //     require(_investorNftDefault != address(0), "nft addr zero");
    //     investorNftDefault = _investorNftDefault;
    // }

    // Changed createCourse to accept investorNftAddress and milestone data
    function createCourse(
        address token,
        uint256 goal,
        uint256 duration,
        address investorNftAddress,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePayouts
    ) external returns (address) {
        // Input validation
        require(token != address(0), "token addr zero");
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
        
        Crowdfund newCourse = new Crowdfund(
            token,
            goal,
            duration,
            msg.sender, // creator is the caller, prevents spoofing
            investorNftAddress,
            milestoneDescriptions,
            milestonePayouts
        );

        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        uint256 deadline = block.timestamp + duration;
        emit CourseCreated(courseAddress, msg.sender, goal, deadline);

        return courseAddress;
    }
}
