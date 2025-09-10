// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CourseNFT
 * @dev An ERC721 token that grants a learner access to a specific course.
 * The right to mint these tokens is restricted to the contract owner,
 * which will be the main course contract responsible for sales.
 */
contract CourseNFT is ERC721, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC721(name, symbol) {
        require(initialOwner != address(0), "Initial owner cannot be zero address");
        transferOwnership(initialOwner);
    }

    /**
     * @dev Mints a new Course Access NFT to a specific learner.
     * Can only be called by the owner of this contract.
     * @param to The address of the learner receiving the NFT.
     * @param tokenId A unique ID for the token being minted.
     */
    function safeMint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }
}
