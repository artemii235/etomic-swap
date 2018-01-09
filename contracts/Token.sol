pragma solidity ^0.4.18;
import 'zeppelin-solidity/contracts/token/StandardToken.sol';

contract Token is StandardToken {
  function Token() public {
    balances[msg.sender] = 1000 ether;
    totalSupply = 1000 ether;
  }
}
