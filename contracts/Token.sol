pragma solidity ^0.4.24;
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Token is StandardToken {
  string public constant name = "Just Token";
  string public constant symbol = "JST";
  uint8 public constant decimals = 18;

  constructor() public {
    balances[msg.sender] = 1000 ether;
    totalSupply_ = 1000 ether;
  }
}
