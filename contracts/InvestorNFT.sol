// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestorNFT
 * @dev Simple ERC721 where only the owner can mint via safeMint.
 */
contract InvestorNFT is ERC721, Ownable {
    uint256 private _tokenCounter;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        _tokenCounter = 0;
    }

    /**
     * @notice safeMint can only be called by owner (Crowdfund after ownership transfer).
     */
    function safeMint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    // Optional helper to expose next token counter if you prefer automatic ids
    function nextTokenId() external view returns (uint256) {
        return _tokenCounter + 1;
    }
}
