pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EtomicSwap {
    enum PaymentState {
        Uninitialized,
        PaymentSent,
        ReceivedSpent,
        SenderRefunded
    }

    enum SecretHashAlgo {
        Dhash160,
        Sha256
    }

    struct Payment {
        bytes20 paymentHash;
        uint64 lockTime;
        PaymentState state;
        SecretHashAlgo secret_hash_algo;
    }

    struct PaymentData {
        bytes20 paymentHash;
        uint64 lockTime;
        PaymentState state;
    }

    mapping (bytes32 => Payment) private payments_state;

    event PaymentSent(bytes32 id);
    event ReceiverSpent(bytes32 id, bytes32 secret);
    event SenderRefunded(bytes32 id);

    constructor() { }

    function payments(bytes32 _id) public view returns(PaymentData memory) {
        return PaymentData(payments_state[_id].paymentHash, payments_state[_id].lockTime, payments_state[_id].state);
    }

    function ethPayment(
        bytes32 _id,
        address _receiver,
        bytes20 _secretHash,
        uint64 _lockTime
    ) external payable {
        require(_receiver != address(0) && msg.value > 0 && payments_state[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                address(0),
                msg.value
            ));

        payments_state[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent,
            SecretHashAlgo.Dhash160
        );

        emit PaymentSent(_id);
    }

    function ethPaymentSha256(
        bytes32 _id,
        address _receiver,
        bytes32 _secretHash,
        uint64 _lockTime
    ) external payable {
        require(_receiver != address(0) && msg.value > 0 && payments_state[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                address(0),
                msg.value
            ));

        payments_state[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent,
            SecretHashAlgo.Sha256
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
        require(_receiver != address(0) && _amount > 0 && payments_state[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                _tokenAddress,
                _amount
            ));

        payments_state[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent,
            SecretHashAlgo.Dhash160
        );

        IERC20 token = IERC20(_tokenAddress);
        require(token.transferFrom(msg.sender, address(this), _amount));
        emit PaymentSent(_id);
    }

    function erc20PaymentSha256(
        bytes32 _id,
        uint256 _amount,
        address _tokenAddress,
        address _receiver,
        bytes32 _secretHash,
        uint64 _lockTime
    ) external payable {
        require(_receiver != address(0) && _amount > 0 && payments_state[_id].state == PaymentState.Uninitialized);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                _tokenAddress,
                _amount
            ));

        payments_state[_id] = Payment(
            paymentHash,
            _lockTime,
            PaymentState.PaymentSent,
            SecretHashAlgo.Sha256
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
        require(payments_state[_id].state == PaymentState.PaymentSent);

        bytes20 paymentHash;

        if (payments_state[_id].secret_hash_algo == SecretHashAlgo.Dhash160) {
            paymentHash = ripemd160(abi.encodePacked(
                msg.sender,
                _sender,
                ripemd160(abi.encodePacked(sha256(abi.encodePacked(_secret)))),
                _tokenAddress,
                _amount
            ));
        } else if (payments_state[_id].secret_hash_algo == SecretHashAlgo.Sha256) {
            paymentHash = ripemd160(abi.encodePacked(
                msg.sender,
                _sender,
                sha256(abi.encodePacked(_secret)),
                _tokenAddress,
                _amount
            ));
        } else {
            revert("Unexpected secret_hash_algo");
        }

        require(paymentHash == payments_state[_id].paymentHash);
        payments_state[_id].state = PaymentState.ReceivedSpent;
        if (_tokenAddress == address(0)) {
            payable(msg.sender).transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.transfer(msg.sender, _amount));
        }

        emit ReceiverSpent(_id, _secret);
    }

    function senderRefund(
        bytes32 _id,
        uint256 _amount,
        bytes20 _secretHash,
        address _tokenAddress,
        address _receiver
    ) external {
        require(payments_state[_id].state == PaymentState.PaymentSent);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                _tokenAddress,
                _amount
            ));

        require(paymentHash == payments_state[_id].paymentHash && block.timestamp >= payments_state[_id].lockTime);

        payments_state[_id].state = PaymentState.SenderRefunded;

        if (_tokenAddress == address(0)) {
            payable(msg.sender).transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.transfer(msg.sender, _amount));
        }

        emit SenderRefunded(_id);
    }

    function senderRefundSha256(
        bytes32 _id,
        uint256 _amount,
        bytes32 _secretHash,
        address _tokenAddress,
        address _receiver
    ) external {
        require(payments_state[_id].state == PaymentState.PaymentSent);

        bytes20 paymentHash = ripemd160(abi.encodePacked(
                _receiver,
                msg.sender,
                _secretHash,
                _tokenAddress,
                _amount
            ));

        require(paymentHash == payments_state[_id].paymentHash && block.timestamp >= payments_state[_id].lockTime);

        payments_state[_id].state = PaymentState.SenderRefunded;

        if (_tokenAddress == address(0)) {
            payable(msg.sender).transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.transfer(msg.sender, _amount));
        }

        emit SenderRefunded(_id);
    }
}
