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
    bytes20 dealHash;
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
    bytes20 dealHash = ripemd160(
      msg.sender,
      _aliceHash,
      _bob,
      _bobHash,
      msg.value,
      address(0)
    );
    deals[_dealId] = Deal(
      dealHash,
      DealState.Initialized
    );
  }

  function initErc20Deal(
    bytes32 _dealId,
    uint _amount,
    address _bob,
    bytes20 _aliceHash,
    bytes20 _bobHash,
    address _tokenAddress
  ) external {
    require(_bob != 0x0 && _tokenAddress != 0x0 && _amount > 0 && deals[_dealId].state == DealState.Uninitialized);
    bytes20 dealHash = ripemd160(
      msg.sender,
      _aliceHash,
      _bob,
      _bobHash,
      _amount,
      _tokenAddress
    );
    deals[_dealId] = Deal(
      dealHash,
      DealState.Initialized
    );
    ERC20 token = ERC20(_tokenAddress);
    require(token.transferFrom(msg.sender, address(this), _amount));
  }

  function aliceClaimsPayment(
    bytes32 _dealId,
    uint _amount,
    address _tokenAddress,
    address _bob,
    bytes20 _aliceHash,
    bytes _bobSecret
  ) external {
    require(deals[_dealId].state == DealState.Initialized);
    bytes20 dealHash = ripemd160(
      msg.sender,
      _aliceHash,
      _bob,
      ripemd160(sha256(_bobSecret)),
      _amount,
      _tokenAddress
    );
    require(dealHash == deals[_dealId].dealHash);

    deals[_dealId].state = DealState.PaymentSentToAlice;
    if (_tokenAddress == 0x0) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      require(token.transfer(msg.sender, _amount));
    }
  }

  function bobClaimsPayment(
    bytes32 _dealId,
    uint _amount,
    address _tokenAddress,
    address _alice,
    bytes20 _bobHash,
    bytes _aliceSecret
  ) external {
    require(deals[_dealId].state == DealState.Initialized);
    bytes20 dealHash = ripemd160(
      _alice,
      ripemd160(sha256(_aliceSecret)),
      msg.sender,
      _bobHash,
      _amount,
      _tokenAddress
    );
    require(dealHash == deals[_dealId].dealHash);
    deals[_dealId].state = DealState.PaymentSentToBob;
    if (_tokenAddress == 0x0) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      require(token.transfer(msg.sender, _amount));
    }
  }
}
