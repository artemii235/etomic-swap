pragma solidity ^0.4.18;
import 'zeppelin-solidity/contracts/token/ERC20.sol';

contract Alice {
  enum DealState {
    Uninitialized,
    Initialized,
    PaymentSentToBob,
    PaymentSentToAlice
  }

  struct Deal {
    address alice;
    address bob;
    address tokenAddress;
    uint amount;
    bytes20 aliceHash;
    bytes20 bobHash;
    DealState state;
  }

  mapping (bytes32 => Deal) public deals;

  function Alice() { }

  function initEthDeal(
    bytes32 _dealId,
    address _bob,
    bytes20 _aliceHash,
    bytes20 _bobHash
  ) external payable {
    require(_bob != 0x0 && msg.value > 0 && deals[_dealId].state == DealState.Uninitialized);
    deals[_dealId] = Deal(
      msg.sender,
      _bob,
      0x0,
      msg.value,
      _aliceHash,
      _bobHash,
      DealState.Initialized
    );
  }

  function initErc20Deal(
    bytes32 _dealId,
    address _bob,
    bytes20 _aliceHash,
    bytes20 _bobHash,
    address _tokenAddress,
    uint _amount
  ) external {
    require(_bob != 0x0 && _tokenAddress != 0x0 && _amount > 0 && deals[_dealId].state == DealState.Uninitialized);
    deals[_dealId].state = DealState.Initialized;
    deals[_dealId].alice = msg.sender;
    deals[_dealId].aliceHash = _aliceHash;
    deals[_dealId].bob = _bob;
    deals[_dealId].bobHash = _bobHash;
    deals[_dealId].tokenAddress = _tokenAddress;
    deals[_dealId].amount = _amount;
    ERC20 token = ERC20(_tokenAddress);
    require(
      token.allowance(msg.sender, address(this)) >= _amount &&
      token.balanceOf(msg.sender) >= _amount
    );
    require(token.transferFrom(msg.sender, address(this), _amount));
  }

  function aliceClaimsPayment(bytes32 _dealId, bytes _bobSecret) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      msg.sender == deals[_dealId].alice &&
      ripemd160(sha256(_bobSecret)) == deals[_dealId].bobHash
    );
    deals[_dealId].state = DealState.PaymentSentToAlice;
    if (deals[_dealId].tokenAddress == 0x0) {
      msg.sender.transfer(deals[_dealId].amount);
    } else {
      ERC20 token = ERC20(deals[_dealId].tokenAddress);
      require(token.transfer(msg.sender, deals[_dealId].amount));
    }
  }

  function bobClaimsPayment(bytes32 _dealId, bytes _aliceSecret) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      msg.sender == deals[_dealId].bob &&
      ripemd160(sha256(_aliceSecret)) == deals[_dealId].aliceHash
    );
    deals[_dealId].state = DealState.PaymentSentToBob;
    if (deals[_dealId].tokenAddress == 0x0) {
      msg.sender.transfer(deals[_dealId].amount);
    } else {
      ERC20 token = ERC20(deals[_dealId].tokenAddress);
      require(token.transfer(msg.sender, deals[_dealId].amount));
    }
  }
}
