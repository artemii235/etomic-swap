pragma solidity ^0.4.18;
import 'zeppelin-solidity/contracts/token/ERC20.sol';

contract EtomicSwap {
  enum DealState {
    Uninitialized,
    Initialized,
    PaymentSentToReceiver,
    PaymentSentToInitiator
  }

  struct Deal {
    address initiator;
    address receiver;
    address tokenAddress;
    uint amount;
    uint claimUntilBlock;
    DealState state;
  }

  mapping (bytes20 => Deal) public deals;

  uint public blocksPerDeal;

  function EtomicSwap(uint _blocksPerDeal) public {
    blocksPerDeal = _blocksPerDeal;
  }

  function initEthDeal(
    bytes20 _dealId,
    address _receiver
  ) external payable {
    require(_receiver != 0x0 && msg.value > 0 && deals[_dealId].state == DealState.Uninitialized);
    deals[_dealId].state = DealState.Initialized;
    deals[_dealId].initiator = msg.sender;
    deals[_dealId].receiver = _receiver;
    deals[_dealId].tokenAddress = 0x0;
    deals[_dealId].amount = msg.value;
    deals[_dealId].claimUntilBlock = block.number + blocksPerDeal;
  }

  function initErc20Deal(
    bytes20 _dealId,
    address _receiver,
    address _tokenAddress,
    uint _amount
  ) external {
    require(_receiver != 0x0 && _tokenAddress != 0x0 && _amount > 0 && deals[_dealId].state == DealState.Uninitialized);
    deals[_dealId].state = DealState.Initialized;
    deals[_dealId].initiator = msg.sender;
    deals[_dealId].receiver = _receiver;
    deals[_dealId].tokenAddress = _tokenAddress;
    deals[_dealId].amount = _amount;
    deals[_dealId].claimUntilBlock = block.number + blocksPerDeal;
    ERC20 token = ERC20(_tokenAddress);
    require(
      token.allowance(msg.sender, address(this)) >= deals[_dealId].amount &&
      token.balanceOf(msg.sender) >= deals[_dealId].amount
    );
    require(token.transferFrom(msg.sender, address(this), _amount));
  }

  function initiatorClaimsPayment(bytes20 _dealId) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      block.number >= deals[_dealId].claimUntilBlock &&
      msg.sender == deals[_dealId].initiator
    );
    deals[_dealId].state = DealState.PaymentSentToInitiator;
    if (deals[_dealId].tokenAddress == 0x0) {
      msg.sender.transfer(deals[_dealId].amount);
    } else {
      ERC20 token = ERC20(deals[_dealId].tokenAddress);
      require(token.transfer(msg.sender, deals[_dealId].amount));
    }
  }

  function receiverClaimsPayment(bytes20 _dealId, bytes secret) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      block.number < deals[_dealId].claimUntilBlock &&
      msg.sender == deals[_dealId].receiver &&
      ripemd160(sha256(secret)) == _dealId
    );
    deals[_dealId].state = DealState.PaymentSentToReceiver;
    if (deals[_dealId].tokenAddress == 0x0) {
      deals[_dealId].receiver.transfer(deals[_dealId].amount);
    } else {
      ERC20 token = ERC20(deals[_dealId].tokenAddress);
      require(token.transfer(deals[_dealId].receiver, deals[_dealId].amount));
    }
  }
}
