pragma solidity ^0.4.18;
import 'zeppelin-solidity/contracts/token/StandardToken.sol';

contract Token is StandardToken {
  string public constant name = "Just Token";
  string public constant symbol = "JST";
  uint8 public constant decimals = 18;

  function Token() public {
    balances[msg.sender] = 1000 ether;
    totalSupply = 1000 ether;
  }
}
