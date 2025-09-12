// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestorNFT
 * @dev Simple ERC721 where only the owner can mint via safeMint.
 */
contract InvestorNFT is ERC721, Ownable {
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
    }

    /**
     * @notice safeMint can only be called by owner (Crowdfund after ownership transfer).
     */
    function safeMint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }
}
