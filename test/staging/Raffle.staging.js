const { network , ethers , getNamedAccounts, deployments } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")
const {assert, expect} = require ("chai")

developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle",  ()=> {
        let raffle, raffleEntranceFee, deployer
        const chainId = network.config.chainId

        beforeEach(async ()=> {
            deployer - (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
        })
        describe("fulfillRandomWords", function(){
            it("works with live Chainlink Automation and VRF, we get a random winner", async ()=>{
                const startingTimestamp = await raffle.getLastTimeStamp()
                const accounts = await ethers.getSigners()

                await new Promise (async (resolve, reject)=>{
                    raffle.once("WinnerPicked()", async()=>{
                        console.log("WinnerPicked event fired")
                        try{
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            assert.equal(raffleState, 0)
                            assert.equal(winnerStartingBalance.toString(), winnerEndingBalance.add(raffleEntranceFee).toString())
                            assert(endingTimeStamp>startingTimestamp)
                        }catch(e){
                            console.log(e);
                            reject(e)
                        }
                    })
                    await raffle.enterRaffle({ value: raffleEntranceFee})
                    const winnerStartingBalance = await accounts[0].getBalance()
                })
            })
        })
    })