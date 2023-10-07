//Raffle

//Enter the lottery (paying some amount)
//Pick the winner randomly (verifiably random)
//Winner to be selected every X minutes - completely automated 

//Chainlink Oracle - random , automated execution


// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

//Imports
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

//Errors
error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title Raffle Contract
 * @author Alior.ETH
 * @notice Smart Contract for a decentralised Raffle
 * @dev implemented Chainlink API VRF V2 and Chainlink Automation
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface{

    /* Type Declarations */
    enum RaffleState {
        OPEN, // 0
        CALCULATING // 1
    }

    /*State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callBackGasLimit;
    uint32 private constant NUMBER_WORDS = 1;
    uint public counter;
    
    /**
     * Use an interval in seconds and a timestamp to slow execution of Upkeep
     */
    uint public immutable i_interval;
    uint public s_lastTimeStamp;

    //Lottery Variables
    address payable s_recentWinner;
    RaffleState private s_raffleState = RaffleState.OPEN;

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
         address vrfCoordinatorV2, //contract
          uint64 subscriptionId,
           bytes32 gasLane,
            uint256 updateInterval,
             uint256 entranceFee,
              uint32 callBackGasLimit
             ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_keyHash = gasLane;
        i_subId = subscriptionId;
        i_callBackGasLimit = callBackGasLimit;
        i_interval = updateInterval;
        s_lastTimeStamp = block.timestamp;

        counter = 0;
    }

    function enterRaffle() payable public{
        if(msg.value < i_entranceFee){revert Raffle__NotEnoughEthEntered();}
        if(s_raffleState != RaffleState.OPEN){revert Raffle__NotOpen();}
        s_players.push(payable(msg.sender));
        //Emit an event when we update mapping or array
        //Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }
    /**
     * @dev This is the function Chainlink Automation Nodes call to look for the upkeepNeeded to return true
     * The following should be true in order for this value to be true:
     * 1. Out time interval to be passed
     * 2. The lottery player pool shoul be at least 1 and have some ETH
     * 3. Our subscription is funded with LINK
     * 4. The lottery should be in OPEN mode (not PENDING)
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        bool timepassed = (block.timestamp - s_lastTimeStamp) > i_interval;

        upkeepNeeded = (isOpen && hasPlayers && hasBalance && timepassed);
        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
    }

    function performUpkeep(bytes calldata /* performData */) external override{
        (bool upKeepNeeded, ) = checkUpkeep((""));
        if (!upKeepNeeded) {
            revert Raffle__UpkeepNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
            s_lastTimeStamp = block.timestamp;
            counter = counter + 1;
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash, 
            i_subId,
            REQUEST_CONFIRMATIONS,
            i_callBackGasLimit,
            NUMBER_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(uint256 /* requestId */ , uint256[] memory randomWords) internal override{
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        (bool success,) = recentWinner.call{value: address(this).balance}("");
        if(!success){
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }
    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }
    function getRecentWinner() public view returns(address){
        return s_recentWinner;
    }
    function getRaffleState() public view returns(RaffleState){
        return s_raffleState;
    }
    function getNumWords() public pure returns(uint256) {
        return NUMBER_WORDS;
    } 
    function getNumberOfPlayers() public view returns(uint256){
        return s_players.length;
    }
    function getLastTimeStamp() public view returns(uint256){
        return s_lastTimeStamp;
    }
    function getRequestConfirmations() public pure returns(uint256){
        return REQUEST_CONFIRMATIONS;
    }
    function getInterval() public view returns(uint256) {
        return i_interval;
    }
}