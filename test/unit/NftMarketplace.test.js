const { network, ethers, deployments, getNamedAccounts } = require('hardhat');
const { developmentChains } = require('../../hardhat-config-helper')
const { assert, expect } = require('chai');

!developmentChains.includes(network.name)
    ? describe.skip('')
    : describe('NftMarketplace contract', () => {
        let deployer, player, nftMarketplace, basicNft;
        const PRICE = ethers.utils.parseEther('0.1');
        const TOKEN_ID = '0';

        beforeEach(async () => {
            await deployments.fixture(['all'])

            deployer = (await getNamedAccounts()).deployer
            //player is just another account that we have inside our hardhat.config.js
            // player = (await getNamedAccounts()).player;

            //select second account
            player = (await ethers.getSigners())[1]

            basicNft = await ethers.getContract('BasicNFT', deployer);
            nftMarketplace = await ethers.getContract('NftMarketplace',  deployer);

            await basicNft.mintNft();
            await basicNft.approve(nftMarketplace.address, TOKEN_ID);
        })

        it("deployer list nft and player buys it", async () => {
            //deployer listItem on NftMarketplace
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);

            //player buys the NFT
            const playerNftMarketplace = await nftMarketplace.connect(player);

            await playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE});

            const newOwner = await basicNft.ownerOf(TOKEN_ID);
            const deployerProceeds = await nftMarketplace.getProceeds(deployer);

            assert.equal(newOwner.toString(), player.address);
            assert.equal(deployerProceeds.toString(), PRICE.toString());
        });
    });