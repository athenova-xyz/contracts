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
        uint256 fundingGoal,
        uint256 deadline
    ) external returns (address) {
    require(fundingGoal > 0, "Funding goal must be > 0");
    require(deadline > block.timestamp, "Deadline must be in the future");
        Crowdfund newCourse = new Crowdfund(msg.sender);
        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        emit CourseCreated(courseAddress, msg.sender, fundingGoal, deadline);
        return courseAddress;
    }
}
