// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CourseNFT
 * @dev An ERC721 token that grants a learner access to a specific course.
 * The right to mint these tokens is restricted to the contract owner,
 * which will be the main course contract responsible for sales.
 */
contract CourseNFT is ERC721, Ownable, ERC2981 {
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        address crowdfundAddress
    ) ERC721(name, symbol) Ownable(initialOwner) {
        require(initialOwner != address(0), "Initial owner cannot be zero address");
        require(crowdfundAddress != address(0), "Crowdfund address cannot be zero");
        // Set EIP-2981 default royalty: receiver = crowdfund contract, feeNumerator = 500 (5%)
        _setDefaultRoyalty(crowdfundAddress, 500);
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

    /// @dev Required override for Solidity multiple inheritance
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
