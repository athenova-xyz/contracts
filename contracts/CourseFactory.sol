// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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

    function createCourse(
        address acceptedToken,
        uint256 fundingGoal,
        uint256 deadline
    ) external returns (address) {
        require(acceptedToken != address(0), "Token address must be non-zero");
        require(fundingGoal > 0, "Funding goal must be > 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        // Compute duration from provided absolute deadline
        uint256 duration = deadline - block.timestamp;
        Crowdfund newCourse = new Crowdfund(
            acceptedToken,
            fundingGoal,
            duration,
            msg.sender // creator
        );
        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        emit CourseCreated(courseAddress, msg.sender, fundingGoal, deadline);
        return courseAddress;
    }
}
