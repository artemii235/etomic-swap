pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EtomicSwap {
    enum PaymentState {
        Uninitialized,
        PaymentSent,
        ReceiverSpent,
        SenderRefunded
    }

    struct Payment {
        bytes20 paymentHash;
        uint64 lockTime;
        PaymentState state;
    }

    mapping (bytes32 => Payment) public payments;

    event PaymentSent(bytes32 id);
    event ReceiverSpent(bytes32 id, bytes32 secret);
    event SenderRefunded(bytes32 id);

    constructor() { }

    function ethPayment(
        bytes32 _id,
        address _receiver,
        bytes20 _secretHash,
        uint64 _lockTime
    ) external payable {
        require(_receiver != address(0) && msg.value > 0 && payments[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                address(0),
                msg.value
            ));

        payments[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent
        );

        emit PaymentSent(_id);
    }

    function erc20Payment(
        bytes32 _id,
        uint256 _amount,
        address _tokenAddress,
        address _receiver,
        bytes20 _secretHash,
        uint64 _lockTime
    ) external payable {
        require(_receiver != address(0) && _amount > 0 && payments[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                _tokenAddress,
                _amount
            ));

        payments[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent
        );

        IERC20 token = IERC20(_tokenAddress);
        require(token.transferFrom(msg.sender, address(this), _amount));
        emit PaymentSent(_id);
    }

    function receiverSpend(
        bytes32 _id,
        uint256 _amount,
        bytes32 _secret,
        address _tokenAddress,
        address _sender
    ) external {
        receiverSpendV2(_id, _amount, _secret, _tokenAddress, _sender, msg.sender);
    }

    function receiverSpendV2(
        bytes32 _id,
        uint256 _amount,
        bytes32 _secret,
        address _tokenAddress,
        address _sender,
        address _receiver
    ) public {
        require(payments[_id].state == PaymentState.PaymentSent);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                _sender,
                ripemd160(abi.encodePacked(sha256(abi.encodePacked(_secret)))),
                _tokenAddress,
                _amount
            ));

        require(paymentHash == payments[_id].paymentHash);
        payments[_id].state = PaymentState.ReceiverSpent;
        if (_tokenAddress == address(0)) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.transfer(_receiver, _amount));
        }

        emit ReceiverSpent(_id, _secret);
    }

    function senderRefund(
        bytes32 _id,
        uint256 _amount,
        bytes20 _paymentHash,
        address _tokenAddress,
        address _receiver
    ) external {
        senderRefundV2(_id, _amount, _paymentHash, _tokenAddress, msg.sender, _receiver);
    }

    function senderRefundV2(
        bytes32 _id,
        uint256 _amount,
        bytes20 _paymentHash,
        address _tokenAddress,
        address _sender,
        address _receiver
    ) public {
        require(payments[_id].state == PaymentState.PaymentSent);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                _sender,
                _paymentHash,
                _tokenAddress,
                _amount
            ));

        require(paymentHash == payments[_id].paymentHash && block.timestamp >= payments[_id].lockTime);

        payments[_id].state = PaymentState.SenderRefunded;

        if (_tokenAddress == address(0)) {
            payable(_sender).transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.transfer(_sender, _amount));
        }

        emit SenderRefunded(_id);
    }
}
