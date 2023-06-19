// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner(address spender, address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);

contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
    }

    event ItemListed(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    //NFT Address -> NFT token id -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    //Seller address => amount earned
    mapping(address => uint256) private s_proceeds;

    modifier notListed(address nftAddress, uint256 tokenId, address owner) {
        Listing memory listing = s_listings[nftAddress][tokenId];

        //if we have that price above 0 that means we already listed this token id and nft
        if(Listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price <=0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(address nftAddress, uint256 tokenId, address spender) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);

        if(owner != spender) {
            revert NftMarketplace__NotOwner(spender, nftAddress, tokenId);
        }
        _;
    }

    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        isOwner(nftAddress, tokenId, msg.sender)
        notListed(nftAddress, tokenId, msg.sender)
    {
        if(price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        IERC721 nft = IERC721(nftAddress);

        //get owner address by tokenId an check if this nft was approved by this smart contract
        if(nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);

        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(
        address nftAddress,
        uint256 tokenId
    )
        external
        payable
        isListed(nftAddress, tokenId)
        nonReentrant
    {
        Listing memory listing = s_listings[nftAddress][tokenId];

        if(msg.value < listing.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listing.price);
        }

        //it is a best practice to accamulate amount of money we ow  to user
        //and then let a user to withdraw them
        s_proceeds[listing.seller] = s_proceeds[listing.seller] + msg.value;
        delete(s_listings[nftAddress][tokenId]);

        IERC721(nftAddress).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, nftAddress, tokenId, listing.price);
    }
}