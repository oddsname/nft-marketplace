const {developmentChains} = require("../hardhat-config-helper");
const {verify} = require('../utils/verify')

module.exports = async function({ getNamedAccounts, network, deployments }) {
    const {deployer} = await getNamedAccounts();
    const {deploy, log} = deployments;

    log('Start to deploy BasicNFT')

    const basicNft = await deploy('BasicNFT', {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_KEY) {
        log('Verifying Contract...')
        await verify(basicNft.address, []);
    }
    log('------------');
}

module.exports.tags = ['all', 'basic-nft'];