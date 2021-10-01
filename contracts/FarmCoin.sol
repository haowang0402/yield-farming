
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FarmCoin is ERC20, Ownable {

    constructor() ERC20("FarmCoin", "FMC") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function transferOwner(address newOwner) public onlyOwner {
        transferOwnership(newOwner);
    }
}