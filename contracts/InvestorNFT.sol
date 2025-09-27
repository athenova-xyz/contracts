// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestorNFT
 * @dev Simple ERC721 where only the owner can mint via safeMint.
 */
contract InvestorNFT is ERC721, Ownable, ERC2981 {
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        address crowdfundAddress
    ) ERC721(name_, symbol_) Ownable(owner_) {
        // Ownership initialized via Ownable base constructor (OpenZeppelin v5)
        // Set EIP-2981 default royalty: receiver = crowdfund contract, feeNumerator = 500 (5%)
        require(crowdfundAddress != address(0), "Crowdfund address cannot be zero");
        _setDefaultRoyalty(crowdfundAddress, 500);
    }

    /**
     * @notice safeMint can only be called by owner (Crowdfund after ownership transfer).
     */
    function safeMint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    /// @dev Required override for Solidity multiple inheritance
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
