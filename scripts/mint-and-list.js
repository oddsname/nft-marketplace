const { ethers, getNamedAccounts } = require('hardhat');

const PRICE = ethers.utils.parseEther('0.1');

async function mintAndList() {
    const { deployer } = await getNamedAccounts();

    const nftMarketPlace = await ethers.getContract('NftMarketplace', deployer);
    const basicNFT = await ethers.getContract('BasicNFT', deployer);

    console.log('Minting...');

    const mintTx = await basicNFT.mintNft();
    const mintTxReceipt = await mintTx.wait(1);
    const {tokenId} = mintTxReceipt.events[0].args;

    console.log('Approving Nft...')

    const approveTx = await basicNFT.approve(nftMarketPlace.address, tokenId);
    await approveTx.wait(1);

    console.log('Listing Nft...');

    const tx = await nftMarketPlace.listItem(basicNFT.address, tokenId, PRICE);
    await tx.wait(1);

    console.log('Listed');
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1);
    })