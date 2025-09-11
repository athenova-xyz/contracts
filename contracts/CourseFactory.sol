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

    // Changed createCourse to accept investorNftAddress and forward it to Crowdfund
    function createCourse(
        address token,
        uint256 goal,
        uint256 duration,
        address creator,
        address investorNftAddress
    ) public returns (address) {
        require(investorNftAddress != address(0), "nft addr zero");
        Crowdfund newCourse = new Crowdfund(
            token,
            goal,
            duration,
            creator,
            investorNftAddress
        );

        address courseAddress = address(newCourse);
        deployedCourses.push(courseAddress);
        emit CourseCreated(courseAddress, creator, goal, duration);

        return address(newCourse);
    }
}
