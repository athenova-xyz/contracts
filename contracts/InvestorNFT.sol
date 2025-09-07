// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestorNFT
 * @dev An ERC721 token representing a backer's unique share in a course.
 * The right to mint these tokens is restricted to the contract owner,
 * which will be the main crowdfunding contract.
 */
contract InvestorNFT is ERC721, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {}

    /**
     * @dev Mints a new Investor Share NFT to a specific backer.
     * Can only be called by the owner of this contract.
     * @param to The address of the backer receiving the NFT.
     * @param tokenId A unique ID for the token being minted.
     */
    function safeMint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }
}
