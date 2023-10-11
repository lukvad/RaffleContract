const { network } = require("hardhat");
const {verify} = require("../utils/verify.js")
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const VRF_SUB_AMOUNT = 2

module.exports = async function ( {getNamedAccounts, deployments}) {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();
    const chaindId = network.config.chainId;
    
    let VRFCoordinatorAddress, subscriptionID,VRFCoordinatorV2Mock
    if(developmentChains.includes(network.name)) {
        VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        VRFCoordinatorAddress = VRFCoordinatorV2Mock.address
        const txResponse = await VRFCoordinatorV2Mock.createSubscription()
        const txReceipt = await txResponse.wait(1)
        subscriptionID = txReceipt.events[0].args.subId; 
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionID, VRF_SUB_AMOUNT)
    }else {
        VRFCoordinatorAddress = networkConfig[chaindId]["VRFCoordinatorV2"]
        subscriptionID = networkConfig[chaindId]["subscriptionId"]
    }
    const entranceFee = networkConfig[chaindId]["entranceFee"]
    const gasLane = networkConfig[chaindId]["gasLane"]
    const callbackGasLimit = networkConfig[chaindId]["callbackGasLimit"]
    const interval = networkConfig[chaindId]["interval"]
    const args = [VRFCoordinatorAddress, subscriptionID, gasLane, interval, entranceFee, callbackGasLimit]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })
    if(developmentChains.includes(network.name)) {
        await VRFCoordinatorV2Mock.addConsumer(subscriptionID, raffle.address)
        log('Consumer is added')
    }
    if(!developmentChains.includes(network.name)){
        log("Verifying ...")
        await verify(raffle.address, args)
    }

    log("--------------------------------------------------------")
}
module.exports.tags = ["all", "raffle"]