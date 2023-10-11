const networkConfig = {
    11155111: {
        name: "sepolia",
        VRFCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "5748",
        callbackGasLimit: "500000",
        interval: "30"
    },
    137: {
        name: "polygon",
        subscriptionId: "5748",
        VRFCoordinatorV2: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
        entranceFee: ethers.utils.parseEther("0.5"),
        gasLane: "0xd729dc84e21ae57ffb6be0053bf2b0668aa2aaf300a2a7b2ddf7dc0bb6e875a8",
        callbackGasLimit: '500000',
        interval: "10000"
    },
    31337: {
        name: "local",
        subscriptionId: "5748",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
        keepersUpdateInterval: "30",
        entranceFee: ethers.utils.parseEther("0.01"), // 0.01 ETH
        interval: "30",
        callbackGasLimit: "500000", // 500,000 gas
    },
}
const developmentChains = ["hardhat", "local"]
const DECIMALS = 8
const VERIFICATION_BLOCK_CONFIRMATIONS = 6
const INITIAL_ANSWER = 160000000000
module.exports = {
    networkConfig,
    developmentChains,
    DECIMALS,
    INITIAL_ANSWER,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
