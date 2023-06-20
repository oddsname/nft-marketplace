const {network, ethers, deployments, getNamedAccounts} = require('hardhat');
const {developmentChains} = require('../../hardhat-config-helper')
const {assert, expect} = require('chai');

!developmentChains.includes(network.name)
    ? describe.skip('')
    : describe('NftMarketplace contract', () => {
        let deployer, player, nftMarketplace, basicNft;
        const PRICE = ethers.utils.parseEther('0.1');
        const TOKEN_ID = '0';
        const EMPTY_ADDRESS = '0,0x0000000000000000000000000000000000000000';

        beforeEach(async () => {
            await deployments.fixture(['all'])

            deployer = (await getNamedAccounts()).deployer
            //player is just another account that we have inside our hardhat.config.js
            // player = (await getNamedAccounts()).player;

            //select second account
            player = (await ethers.getSigners())[2]

            basicNft = await ethers.getContract('BasicNFT', deployer);
            nftMarketplace = await ethers.getContract('NftMarketplace', deployer);

            await basicNft.mintNft();
            await basicNft.approve(nftMarketplace.address, TOKEN_ID);
        })

        describe('listItem function', () => {
            it('listItem check state changes', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);

                const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(listing.price.toString(), PRICE.toString())
                assert.equal(listing.seller.toString(), deployer.toString());
            });

            it('listItem check price error', async () => {
                await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, '0')).to.be.revertedWith('NftMarketplace__PriceMustBeAboveZero');
                await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, '-1')).to.be.reverted;
                await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, 'test')).to.be.reverted;
            });

            // it('check address error', async () => {
            // const {deploy} = deployments;
            //
            // const anotherBasicNft = await deploy('BasicNFT', {
            //     from: player.address,
            //     args: [],
            //     log: false,
            //     waitConfirmations: 1
            // })
            //
            // await expect(nftMarketplace.listItem(anotherBasicNft.address, TOKEN_ID, PRICE)).to.be.revertedWith('NftMarketplace__NotApprovedMarketplace');
            // });

            it('listItem check event emit', async () => {
                await new Promise(async (resolve, reject) => {
                    nftMarketplace.once('ItemListed', (sender, nftAddress, tokenId, price) => {
                        try {
                            assert.equal(sender.toString(), deployer.toString());
                            assert.equal(nftAddress.toString(), basicNft.address.toString())
                            assert.equal(tokenId.toString(), TOKEN_ID);
                            assert.equal(price.toString(), PRICE.toString());
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });

                    try {
                        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            it('listItem check event emit with player', async () => {
                const price = ethers.utils.parseEther('0.2');
                const token = '1';

                const playerBasicNft = await basicNft.connect(player);
                const playerNftMarketPlace = await nftMarketplace.connect(player);

                await playerBasicNft.mintNft()
                await playerBasicNft.approve(nftMarketplace.address, token)

                await new Promise(async (resolve, reject) => {
                    nftMarketplace.once('ItemListed', (sender, nftAddress, tokenId, price) => {
                        try {
                            assert.equal(sender.toString(), player.address.toString());
                            assert.equal(nftAddress.toString(), playerBasicNft.address.toString())
                            assert.equal(tokenId.toString(), token.toString());
                            assert.equal(price.toString(), price.toString());
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });

                    try {
                        await playerNftMarketPlace.listItem(basicNft.address, token, price);
                    } catch (e) {
                        reject(e);
                    }
                });
            })
        })

        describe('buyItem function', () => {

            it('buyItem check price error', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const playerNftMarketplace = await nftMarketplace.connect(player);
                const wrongPrice = ethers.utils.parseEther('0.099');

                await expect(playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: wrongPrice}))
                    .to
                    .be
                    .revertedWith(`NftMarketplace__PriceNotMet`);

                await playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE});

            });

            it('buyItem check storage', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const playerNftMarketplace = await nftMarketplace.connect(player);

                await playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE});

                const proceeds = await nftMarketplace.getProceeds(deployer);
                const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(proceeds.toString(), PRICE.toString());
                assert.equal(listing.toString(), EMPTY_ADDRESS);
            });

            it('buyItem check event emit', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const playerNftMarketplace = await nftMarketplace.connect(player);

                await new Promise(async (resolve, reject) => {
                    playerNftMarketplace.once('ItemBought', (sender, nftAddress, token, price) => {
                        try {
                            assert.equal(sender.toString(), player.address.toString());
                            assert.equal(nftAddress.toString(), basicNft.address.toString());
                            assert.equal(token.toString(), TOKEN_ID)
                            assert.equal(price.toString(), PRICE);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    })

                    await playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE});
                })
            });
        });

        describe('cancelListing function', async () => {
            it('cancelListing listing must be listed', async () => {
                await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.be.revertedWith('NftMarketplace__NotListed')
            })

            it('cancelListing only owner can cancel', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const playerNftMarketplace = await nftMarketplace.connect(player);

                let listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(listing.seller.toString(), deployer.toString());
                assert.equal(listing.price.toString(), PRICE.toString())

                await expect(playerNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.be.revertedWith('NftMarketplace__NotOwner');
                await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID);

                listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(listing, EMPTY_ADDRESS);
            })

            it('cancelListing emit event', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);

                await new Promise(async (resolve, reject) => {
                    nftMarketplace.once('ItemCanceled', (sender, nftAddress, token) => {
                        try {
                            assert.equal(sender, deployer.toString());
                            assert.equal(nftAddress, basicNft.address);
                            assert.equal(token.toString(), TOKEN_ID);

                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });

                    await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID);
                });
            });
        });

        describe('updateListing function', () => {

            it('updateListing check storage change', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);

                let listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(listing.seller.toString(), deployer.toString());
                assert.equal(listing.price.toString(), PRICE.toString())

                const newPrice = ethers.utils.parseEther('0.5')

                await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice);

                listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);

                assert.equal(listing.seller.toString(), deployer.toString());
                assert.equal(listing.price.toString(), newPrice.toString())
            })

            it('updateListing only owner can update',async  () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const playerNftMarketplace = await nftMarketplace.connect(player);

                expect(playerNftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)).to.be.revertedWith('NftMarketplace__NotOwner')
            })

            it('updateListing listing must be listed',async  () => {
                expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)).to.be.revertedWith('NftMarketplace__NotListed')
            })

            it('update listing check event emit', async () => {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                const newPrice = ethers.utils.parseEther('0.3')

                await new Promise(async (resolve, reject) => {
                    nftMarketplace.once('ItemUpdated', (sender, nftAddress, tokenId, price) => {
                        try {
                            assert.equal(sender.toString(), deployer.toString());
                            assert.equal(nftAddress.toString(), basicNft.address.toString())
                            assert.equal(tokenId.toString(), TOKEN_ID);
                            assert.equal(price.toString(), newPrice.toString());
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                    try {
                        await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });

        describe('withdrawProceeds function', () => {
            it('withdrawProceeds withdraw no proceeds', async () => {
                await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith('NftMarketplace__NoProceeds');
            })

            it('withdrawProceeds should withdraw successfully', async () => {
                const price = ethers.utils.parseEther('2');
                const playerNftMarketplace = await nftMarketplace.connect(player);

                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, price);
                await playerNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: price});

                const deployerProceeds = await nftMarketplace.getProceeds(deployer);

                assert.equal(
                    price.toString(),
                    deployerProceeds.toString()
                );
            })
        });

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