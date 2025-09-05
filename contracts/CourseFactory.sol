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
        uint256 deadline,
        address creator
    ) external returns (address) {
        Crowdfund newCourse = new Crowdfund();
        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        emit CourseCreated(courseAddress, creator, fundingGoal, deadline);
        return courseAddress;
    }
}
