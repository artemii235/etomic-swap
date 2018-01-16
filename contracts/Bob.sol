pragma solidity ^0.4.18;
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/token/ERC20.sol';

contract Bob {
  using SafeMath for uint;

  enum DepositState {
    Uninitialized,
    BobMadeDeposit,
    AliceClaimedDeposit,
    BobClaimedDeposit
  }

  enum PaymentState {
    Uninitialized,
    BobMadePayment,
    AliceClaimedPayment,
    BobClaimedPayment
  }

  struct BobDeposit {
    address alice;
    address bob;
    uint aliceCanClaimAfter;
    bytes20 secretHash;
    address tokenAddress;
    uint amount;
    DepositState state;
  }

  struct BobPayment {
    address alice;
    address bob;
    uint bobCanClaimAfter;
    bytes20 secretHash;
    address tokenAddress;
    uint amount;
    PaymentState state;
  }

  uint public blocksPerDeal;

  mapping (bytes32 => BobDeposit) public deposits;

  mapping (bytes32 => BobPayment) public payments;

  function Bob(uint _blocksPerDeal) {
    require(_blocksPerDeal > 0);
    blocksPerDeal = _blocksPerDeal;
  }

  function bobMakesEthDeposit(
    bytes32 _txId,
    address _alice,
    bytes20 _secretHash
  ) external payable {
    require(_alice != 0x0 && msg.value > 0 && deposits[_txId].state == DepositState.Uninitialized);
    deposits[_txId] = BobDeposit(
      _alice,
      msg.sender,
      block.number.add(blocksPerDeal.mul(2)),
      _secretHash,
      0x0,
      msg.value,
      DepositState.BobMadeDeposit
    );
  }

  function bobMakesErc20Deposit(
    bytes32 _txId,
    address _alice,
    bytes20 _secretHash,
    address _tokenAddress,
    uint _amount
  ) external {
    require(
      _alice != 0x0 &&
      _amount > 0 &&
      deposits[_txId].state == DepositState.Uninitialized &&
      _tokenAddress != 0x0
    );
    deposits[_txId] = BobDeposit(
      _alice,
      msg.sender,
      block.number.add(blocksPerDeal.mul(2)),
      _secretHash,
      _tokenAddress,
      _amount,
      DepositState.BobMadeDeposit
    );
    ERC20 token = ERC20(_tokenAddress);
    require(
      token.allowance(msg.sender, address(this)) >= _amount &&
      token.balanceOf(msg.sender) >= _amount
    );
    require(token.transferFrom(msg.sender, address(this), _amount));
  }

  function bobClaimsDeposit(bytes32 _txId, bytes _secret) external {
    require(
      deposits[_txId].state == DepositState.BobMadeDeposit &&
      msg.sender == deposits[_txId].bob &&
      block.number < deposits[_txId].aliceCanClaimAfter &&
      ripemd160(sha256(_secret)) == deposits[_txId].secretHash
    );
    deposits[_txId].state = DepositState.BobClaimedDeposit;
    if (deposits[_txId].tokenAddress == 0x0) {
      msg.sender.transfer(deposits[_txId].amount);
    } else {
      ERC20 token = ERC20(deposits[_txId].tokenAddress);
      require(token.transfer(msg.sender, deposits[_txId].amount));
    }
  }

  function aliceClaimsDeposit(bytes32 _txId) external {
    require(
      deposits[_txId].state == DepositState.BobMadeDeposit &&
      msg.sender == deposits[_txId].alice &&
      block.number >= deposits[_txId].aliceCanClaimAfter
    );
    deposits[_txId].state = DepositState.AliceClaimedDeposit;
    if (deposits[_txId].tokenAddress == 0x0) {
      msg.sender.transfer(deposits[_txId].amount);
    } else {
      ERC20 token = ERC20(deposits[_txId].tokenAddress);
      require(token.transfer(msg.sender, deposits[_txId].amount));
    }
  }

  function bobMakesEthPayment(
    bytes32 _txId,
    address _alice,
    bytes20 _secretHash
  ) external payable {
    require(_alice != 0x0 && msg.value > 0 && payments[_txId].state == PaymentState.Uninitialized);
    payments[_txId] = BobPayment(
      _alice,
      msg.sender,
      block.number.add(blocksPerDeal),
      _secretHash,
      0x0,
      msg.value,
      PaymentState.BobMadePayment
    );
  }

  function bobMakesErc20Payment(
    bytes32 _txId,
    address _alice,
    bytes20 _secretHash,
    address _tokenAddress,
    uint _amount
  ) external {
    require(
      _alice != 0x0 &&
      _amount > 0 &&
      payments[_txId].state == PaymentState.Uninitialized &&
      _tokenAddress != 0x0
    );
    payments[_txId] = BobPayment(
      _alice,
      msg.sender,
      block.number.add(blocksPerDeal),
      _secretHash,
      _tokenAddress,
      _amount,
      PaymentState.BobMadePayment
    );
    ERC20 token = ERC20(_tokenAddress);
    require(
      token.allowance(msg.sender, address(this)) >= _amount &&
      token.balanceOf(msg.sender) >= _amount
    );
    require(token.transferFrom(msg.sender, address(this), _amount));
  }

  function bobClaimsPayment(bytes32 _txId) external {
    require(
      payments[_txId].state == PaymentState.BobMadePayment &&
      msg.sender == payments[_txId].bob &&
      block.number >= payments[_txId].bobCanClaimAfter
    );
    payments[_txId].state = PaymentState.BobClaimedPayment;
    if (payments[_txId].tokenAddress == 0x0) {
      msg.sender.transfer(payments[_txId].amount);
    } else {
      ERC20 token = ERC20(payments[_txId].tokenAddress);
      require(token.transfer(msg.sender, payments[_txId].amount));
    }
  }

  function aliceClaimsPayment(bytes32 _txId, bytes _secret) external {
    require(
      payments[_txId].state == PaymentState.BobMadePayment &&
      msg.sender == payments[_txId].alice &&
      block.number < payments[_txId].bobCanClaimAfter &&
      ripemd160(sha256(_secret)) == payments[_txId].secretHash
    );
    payments[_txId].state = PaymentState.AliceClaimedPayment;
    if (payments[_txId].tokenAddress == 0x0) {
      msg.sender.transfer(payments[_txId].amount);
    } else {
      ERC20 token = ERC20(payments[_txId].tokenAddress);
      require(token.transfer(msg.sender, payments[_txId].amount));
    }
  }
}
