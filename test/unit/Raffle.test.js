const { network , ethers , getNamedAccounts, deployments } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")
const {assert, expect} = require ("chai")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle", async ()=> {
        let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId

        beforeEach(async ()=> {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture("all")
            raffle = await ethers.getContract("Raffle", deployer)
            VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", async ()=> {
            it("initialises the raffle contract", async ()=> {
                const raffleState = await raffle.getRaffleState()
                const interval = await raffle.getInterval()
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])

            })
        })
        describe("enter raffle", async()=> {
            it("reverts when not deposited enough", async ()=> {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEthEntered()")
            })
            it("records each player who deposits", async()=> {
                await raffle.enterRaffle({value: raffleEntranceFee})
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits an event", async()=>{
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(raffle, "RaffleEnter")
            })
            it("it doesn't allow to enter Raffle when calculating", async ()=> {
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                await raffle.performUpkeep([])
                await expect(raffle.raffleEnter({value:raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen()")
            })
        })
    })