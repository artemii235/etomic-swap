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

  mapping (uint => Deal) public deals;

  address public etomicRelay;

  uint public blocksPerDeal;

  event NeedDealApprove(uint indexed dealId, bytes32 indexed etomicTxId);

  modifier OnlyEtomicRelay() {
    require(msg.sender == etomicRelay);
    _;
  }

  function EtomicSwap(address _etomicRelay, uint _blocksPerDeal) public {
    etomicRelay = _etomicRelay;
    blocksPerDeal = _blocksPerDeal;
  }

  function initEthDeal(
    uint _dealId,
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
    uint _dealId,
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

  function confirmDeal(uint _dealId) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      msg.sender == deals[_dealId].initiator &&
      block.number < deals[_dealId].claimUntilBlock
    );
    deals[_dealId].state = DealState.PaymentSentToReceiver;
    if (deals[_dealId].tokenAddress == 0x0) {
      deals[_dealId].receiver.transfer(deals[_dealId].amount);
    } else {
      ERC20 token = ERC20(deals[_dealId].tokenAddress);
      require(token.transfer(deals[_dealId].receiver, deals[_dealId].amount));
    }
  }

  function initiatorClaimsPayment(uint _dealId) external {
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

  function receiverClaimsPayment(uint _dealId, bytes32 _etomicTxId) external {
    require(
      deals[_dealId].state == DealState.Initialized &&
      block.number < deals[_dealId].claimUntilBlock &&
      msg.sender == deals[_dealId].receiver
    );
    NeedDealApprove(_dealId, _etomicTxId);
  }

  function approveDeal(uint _dealId) external OnlyEtomicRelay {
    require(
      deals[_dealId].state == DealState.Initialized &&
      block.number < deals[_dealId].claimUntilBlock
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
