pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./FarmCoin.sol";
import "hardhat/console.sol";
contract FarmCoinFactory {
    mapping(address => uint256) public stakingBalance;
    mapping(address => uint256) public lockDownPeriod;
    mapping(address => uint256) public startTime;
    mapping(address => uint256) public farmCoinBalance;
    mapping(address => bool) public isStaked;

    IERC20 public usdcToken;
    FarmCoin public farmCoin;

    event Stake(address indexed from, uint256 amount, uint256 lock_down);
    event Unstake(address indexed from, uint256 amount);

    constructor(
        IERC20 _usdcToekn,
        FarmCoin _farmCoin
        ) {
            usdcToken = _usdcToekn;
            farmCoin = _farmCoin;
        }
    function calculateYield(address caller, uint256 yield_amt) private view returns(uint256){
        require(isStaked[caller]== true, "the user must be staked. ");
        uint256 time_diff = block.timestamp - startTime[caller];
        uint256 number_of_days = time_diff/86400;
        uint256 interest = 0;
        if (lockDownPeriod[caller] == 0){
            interest = yield_amt /10 /365 * number_of_days;
        }
        else if(lockDownPeriod[caller] == 15552000){
            interest = yield_amt /5/365 * number_of_days;
        }
        else{
            interest = yield_amt *3/10 /365 * number_of_days;
        }
        return interest;
    }
    
    function stake(uint256 amt, uint256 lock_down_period) public {
        require(amt > 0 && usdcToken.balanceOf(msg.sender) >= amt, "staking amount could not be zero or insufficient usdc balance");
        //console.log("%s has staked with %d usdc balance and %d amt", msg.sender,usdcToken.balanceOf(msg.sender), amt);
        // if already staked, we want to calculate the interest already generated.
        if (isStaked[msg.sender]){
            uint256 prev_interest = calculateYield(msg.sender, stakingBalance[msg.sender]);
            farmCoinBalance[msg.sender] += prev_interest;
        }
        usdcToken.transferFrom(msg.sender, address(this), amt);
        stakingBalance[msg.sender] += amt;
        startTime[msg.sender] = block.timestamp;
        lockDownPeriod[msg.sender] = lock_down_period;
        isStaked[msg.sender] = true;
        emit Stake(msg.sender, amt, lock_down_period);
    }
    function withdrawYield() public{
        farmCoin.mint(msg.sender, farmCoinBalance[msg.sender]);
        farmCoinBalance[msg.sender] = 0;
    }
    function unstake(uint256 amt) public {
        require(amt > 0 && stakingBalance[msg.sender] >= amt, "unstaking amount could not be zero or insufficient staking balance");
        uint256 interest = calculateYield(msg.sender, amt);
        uint256 time_diff = block.timestamp - startTime[msg.sender];
        if(time_diff < lockDownPeriod[msg.sender]){
            usdcToken.transfer(msg.sender, amt * 9 / 10);
        }
        else{
            usdcToken.transfer(msg.sender, amt);
        }
        stakingBalance[msg.sender] -= amt;
        if(stakingBalance[msg.sender] == 0){
            isStaked[msg.sender] = false;
        }
        farmCoinBalance[msg.sender] += interest;
        emit Unstake(msg.sender, amt);
    }
}
