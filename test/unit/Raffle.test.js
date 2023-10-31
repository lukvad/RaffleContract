const { network , ethers , getNamedAccounts, deployments } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")
const {assert, expect} = require ("chai")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle",  ()=> {
        let raffle, raffleContract, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval, player, accounts
        const chainId = network.config.chainId

        beforeEach(async ()=> {
            accounts = await ethers.getSigners();
            player = accounts[1]
            await deployments.fixture("all")
            raffleContract = await ethers.getContract("Raffle")
            raffle = raffleContract.connect(player)
            VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
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
                assert.equal(playerFromContract, player.address)
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
            // it("picks a winner, resets the lottery and sends the money", async()=>{
            //     const addittionalEntrants = 3
            //     const startingAccountIndex = 1
            //     const accounts = await ethers.getSigners()
            //     for(let i=startingAccountIndex; i < startingAccountIndex + addittionalEntrants ; i++){
            //         const accountConnectedRaffle = raffle.connect(accounts[i])
            //         await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
            //     }
            //     const startingTimestamp = await raffle.getLastTimeStamp()
            //     await new Promise(async (resolve,reject)=>{
            //         raffle.once("WinnerPicked()",async ()=>{
            //             console.log("found the event");
            //             try{
            //                 console.log(recentWinner)
            //                 console.log(accounts[0]);
            //                 console.log(accounts[1]);
            //                 console.log(accounts[2]);
            //                 console.log(accounts[3]);
            //                 const recentWinner = await raffle.getRecentWinner()
            //                 const raffleState = await raffle.getRaffleState()
            //                 const endingTimestamp = await raffle.getLastTimeStamp()
            //                 const NumPlayers = await raffle.getNumberOfPlayers()
            //                 assert.equal(NumPlayers.toString(), "0")
            //                 assert.equal(raffleState.toString(), "0")
            //                 assert(endingTimestamp  > startingTimestamp)
            //             }catch(e){
            //                 reject(e)
            //             }
            //             resolve()
            //         })
            //         const tx = await raffle.performUpkeep([])
            //         const txReceipt = await tx.wait(1)
            //         await VRFCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)

            //     })
            // })
            it("picks a winner, resets, and sends money", async () => {
                const additionalEntrances = 3 // to test
                const startingIndex = 2
                let startingBalance
                for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
                    raffle = raffleContract.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimeStamp = await raffle.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                // This will be more important for our staging tests...
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => { // event listener for WinnerPicked
                        console.log("WinnerPicked event fired!")
                        // assert throws an error if it fails, so we need to wrap
                        // it in a try/catch so that the promise returns event
                        // if it fails.
                        try {
                            // Now lets get the ending values...
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerBalance = await accounts[2].getBalance()
                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            // Comparisons to check if our ending values are correct:
                            assert.equal(recentWinner.toString(), accounts[2].address)
                            assert.equal(raffleState, 0)
                            assert.equal(
                                winnerBalance.toString(), 
                                startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                    .add(
                                        raffleEntranceFee
                                            .mul(additionalEntrances)
                                            .add(raffleEntranceFee)
                                    )
                                    .toString()
                            )
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve() // if try passes, resolves the promise 
                        } catch (e) { 
                            reject(e) // if try fails, rejects the promise
                        }
                    })

                    // kicking off the event by mocking the chainlink keepers and vrf coordinator
                    try {
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      startingBalance = await accounts[2].getBalance()
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )
                    } catch (e) {
                        reject(e)
                    }
                })
            })
        }) 

    })