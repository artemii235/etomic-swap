pragma solidity ^0.5.0;
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

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
    bytes20 depositHash;
    uint64 lockTime;
    DepositState state;
  }

  struct BobPayment {
    bytes20 paymentHash;
    uint64 lockTime;
    PaymentState state;
  }

  mapping (bytes32 => BobDeposit) public deposits;

  mapping (bytes32 => BobPayment) public payments;

  constructor() public { }

  function bobMakesEthDeposit(
    bytes32 _txId,
    address _alice,
    bytes20 _bobHash,
    bytes20 _aliceHash,
    uint64 _lockTime
  ) external payable {
    require(_alice != address(0) && msg.value > 0 && deposits[_txId].state == DepositState.Uninitialized);
    bytes20 depositHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      _bobHash,
      _aliceHash,
      address(0),
      msg.value
    ));
    deposits[_txId] = BobDeposit(
      depositHash,
      _lockTime,
      DepositState.BobMadeDeposit
    );
  }

  function bobMakesErc20Deposit(
    bytes32 _txId,
    uint256 _amount,
    address _alice,
    bytes20 _bobHash,
    bytes20 _aliceHash,
    address _tokenAddress,
    uint64 _lockTime
  ) external {
    bytes20 depositHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      _bobHash,
      _aliceHash,
      _tokenAddress,
      _amount
    ));
    deposits[_txId] = BobDeposit(
      depositHash,
      _lockTime,
      DepositState.BobMadeDeposit
    );
    ERC20 token = ERC20(_tokenAddress);
    assert(token.transferFrom(msg.sender, address(this), _amount));
  }

  function bobClaimsDeposit(
    bytes32 _txId,
    uint256 _amount,
    bytes32 _bobSecret,
    bytes20 _aliceHash,
    address _alice,
    address _tokenAddress
  ) external {
    require(deposits[_txId].state == DepositState.BobMadeDeposit);
    bytes20 depositHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      ripemd160(abi.encodePacked(sha256(abi.encodePacked(_bobSecret)))),
      _aliceHash,
      _tokenAddress,
      _amount
    ));
    require(depositHash == deposits[_txId].depositHash && now < deposits[_txId].lockTime);
    deposits[_txId].state = DepositState.BobClaimedDeposit;
    if (_tokenAddress == address(0)) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      assert(token.transfer(msg.sender, _amount));
    }
  }

  function aliceClaimsDeposit(
    bytes32 _txId,
    uint256 _amount,
    bytes32 _aliceSecret,
    address _bob,
    address _tokenAddress,
    bytes20 _bobHash
  ) external {
    require(deposits[_txId].state == DepositState.BobMadeDeposit);
    bytes20 depositHash = ripemd160(abi.encodePacked(
      msg.sender,
      _bob,
      _bobHash,
      ripemd160(abi.encodePacked(sha256(abi.encodePacked(_aliceSecret)))),
      _tokenAddress,
      _amount
    ));
    require(depositHash == deposits[_txId].depositHash && now >= deposits[_txId].lockTime);
    deposits[_txId].state = DepositState.AliceClaimedDeposit;
    if (_tokenAddress == address(0)) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      assert(token.transfer(msg.sender, _amount));
    }
  }

  function bobMakesEthPayment(
    bytes32 _txId,
    address _alice,
    bytes20 _secretHash,
    uint64 _lockTime
  ) external payable {
    require(_alice != address(0) && msg.value > 0 && payments[_txId].state == PaymentState.Uninitialized);
    bytes20 paymentHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      _secretHash,
      address(0),
      msg.value
    ));
    payments[_txId] = BobPayment(
      paymentHash,
      _lockTime,
      PaymentState.BobMadePayment
    );
  }

  function bobMakesErc20Payment(
    bytes32 _txId,
    uint256 _amount,
    address _alice,
    bytes20 _secretHash,
    address _tokenAddress,
    uint64 _lockTime
  ) external {
    require(
      _alice != address(0) &&
      _amount > 0 &&
      payments[_txId].state == PaymentState.Uninitialized &&
      _tokenAddress != address(0)
    );
    bytes20 paymentHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      _secretHash,
      _tokenAddress,
      _amount
    ));
    payments[_txId] = BobPayment(
      paymentHash,
      _lockTime,
      PaymentState.BobMadePayment
    );
    ERC20 token = ERC20(_tokenAddress);
    assert(token.transferFrom(msg.sender, address(this), _amount));
  }

  function bobClaimsPayment(
    bytes32 _txId,
    uint256 _amount,
    address _alice,
    address _tokenAddress,
    bytes20 _secretHash
  ) external {
    require(payments[_txId].state == PaymentState.BobMadePayment);
    bytes20 paymentHash = ripemd160(abi.encodePacked(
      _alice,
      msg.sender,
      _secretHash,
      _tokenAddress,
      _amount
    ));
    require(now >= payments[_txId].lockTime && paymentHash == payments[_txId].paymentHash);
    payments[_txId].state = PaymentState.BobClaimedPayment;
    if (_tokenAddress == address(0)) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      assert(token.transfer(msg.sender, _amount));
    }
  }

  function aliceClaimsPayment(
    bytes32 _txId,
    uint256 _amount,
    bytes32 _secret,
    address _bob,
    address _tokenAddress
  ) external {
    require(payments[_txId].state == PaymentState.BobMadePayment);
    bytes20 paymentHash = ripemd160(abi.encodePacked(
      msg.sender,
      _bob,
      ripemd160(abi.encodePacked(sha256(abi.encodePacked(_secret)))),
      _tokenAddress,
      _amount
    ));
    require(now < payments[_txId].lockTime && paymentHash == payments[_txId].paymentHash);
    payments[_txId].state = PaymentState.AliceClaimedPayment;
    if (_tokenAddress == address(0)) {
      msg.sender.transfer(_amount);
    } else {
      ERC20 token = ERC20(_tokenAddress);
      assert(token.transfer(msg.sender, _amount));
    }
  }
}
