const { network, ethers, deployments, getNamedAccounts } = require('hardhat');
const { developmentChains } = require('../../hardhat-config-helper')


!developmentChains.includes(network.name)
    ? describe.skip('')
    : describe('NftMarketplace contract', () => {
        let deployer, nftMarketplace;

        beforeEach(async () => {
            await deployments.fixture(['all'])

            deployer = (await getNamedAccounts()).deployer

            nftMarketplace = ethers.getContract('NftMarketplace',  deployer);
        })

    });