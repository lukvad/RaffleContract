const { network , ethers , getNamedAccounts, deployments } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")
const {assert, expect} = require ("chai")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle",  ()=> {
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

        describe("constructor",  ()=> {
            it("initialises the raffle contract", async ()=> {
                const raffleState = await raffle.getRaffleState()
                const interval = await raffle.getInterval()
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])

            })
        })
        describe("enter raffle", ()=> {
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
                await expect(raffle.enterRaffle({value:raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen()")
            })
        })
        describe("checkUpkeep", ()=>{
            it("returns false when people don't send any ETH", async ()=>{
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns false if raffle isn't open",async()=>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                await raffle.performUpkeep([])
                const raffleState = await raffle.getRaffleState()
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(),"1")
                assert(!upkeepNeeded)
            })
            it("return false if enough time hasn't passed", async()=>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 3])
                await network.provider.send("evm_mine", [])
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("return true if enough time hase passed, there are players and money deposited and lottery is open", async()=>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert(upkeepNeeded)
            })
        })
        describe("performUpkeep", ()=>{
            it("runs only if checUpkeep is true", async()=>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })
            it("reverts when checkUpkeep is false", async()=>{
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNeeded")
            })
            it("updates raffle state, emits event and calls vrf coordinator", async ()=>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep([])
                const txReceipt = await tx.wait(1)
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber()>0)
                assert(raffleState)
            })
        })
        describe("fulfillRandomWords", ()=> {
            beforeEach(async()=> {
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])            
            })
            it("can only be called after performUpkeep", async()=>{
                await expect(VRFCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(VRFCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })
            it("picks a winner, resets the lottery and sends the money", async()=>{
                const addittionalEntrants = 3
                const startingAccountIndex = 1
                const accounts = await ethers.getSigners()
                for(let i=startingAccountIndex; i < startingAccountIndex + addittionalEntrants ; i++){
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
                }
                const startingTimestamp = await raffle.getLastTimeStamp()
                await new Promise(async (resolve,reject)=>{
                    raffle.once("WinnerPicked",async ()=>{
                        console.log("found the event");
                        try{
                            console.log(recentWinner)
                            console.log(accounts[0]);
                            console.log(accounts[1]);
                            console.log(accounts[2]);
                            console.log(accounts[3]);
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const endingTimestamp = await raffle.getLastTimeStamp()
                            const NumPlayers = await raffle.getNumberOfPlayers()
                            assert.equal(NumPlayers.toString(), "0")
                            assert.equal(raffleState.toString(), "0")
                            assert(endingTimestamp  > startingTimestamp)
                        }catch(e){
                            reject(e)
                        }
                        resolve()
                    })
                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    await VRFCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)

                })
            })
        }) 

    })