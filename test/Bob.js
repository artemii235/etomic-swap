const Bob = artifacts.require('Bob');
const Token = artifacts.require('Token');
const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const EVMThrow = 'VM Exception while processing transaction';

require('chai')
  .use(require('chai-as-promised'))
  .should();

async function increaseTime (increaseAmount) {
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      id: Date.now(),
      params: [increaseAmount]
    }, function () {
      
    });
}

async function currentEvmTime() {
  const block = await web3.eth.getBlock("latest");
  return block.timestamp;
}

const txId = '0x' + crypto.randomBytes(32).toString('hex');
const [DEPOSIT_UNINITIALIZED, BOB_MADE_DEPOSIT, ALICE_CLAIMED_DEPOSIT, BOB_CLAIMED_DEPOSIT] = [0, 1, 2, 3];
const [PAYMENT_UNINITIALIZED, BOB_MADE_PAYMENT, ALICE_CLAIMED_PAYMENT, BOB_CLAIMED_PAYMENT] = [0, 1, 2, 3];

const secret = crypto.randomBytes(32);
const secretHash = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret).digest()).digest('hex');
const secretHex = '0x' + secret.toString('hex');

const zeroAddr = '0x0000000000000000000000000000000000000000';

contract('Bob', function(accounts) {

  beforeEach(async function () {
    this.bob = await Bob.new();
    this.token = await Token.new();
    await this.token.transfer(accounts[1], web3.utils.toWei('100'));
  });

  it('should create contract with uninitialized deposits and payments', async function () {
    const deposit = await this.bob.deposits(txId);
    assert.equal(deposit[2].valueOf(), DEPOSIT_UNINITIALIZED);
    const payment = await this.bob.payments(txId);
    assert.equal(payment[2].valueOf(), PAYMENT_UNINITIALIZED);
  });

  it('should allow Bob to make ETH deposit', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      secretHash,
      lockTime
    ];
    await this.bob.bobMakesEthDeposit(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    const deposit = await this.bob.deposits(txId);

    // locktime
    assert.equal(deposit[1].valueOf(), lockTime);
    // status
    assert.equal(deposit[2].valueOf(), BOB_MADE_DEPOSIT);

    // should not allow to deposit again
    await this.bob.bobMakesEthDeposit(...params, { value: web3.utils.toWei('1') }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ERC20 deposit', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      secretHash,
      this.token.address,
      lockTime
    ];

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;

    //check contract token balance
    const balance = await this.token.balanceOf(this.bob.address);
    assert.equal(balance.toString(), web3.utils.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // locktime
    assert.equal(deposit[1].valueOf(), lockTime);
    // status
    assert.equal(deposit[2].valueOf(), BOB_MADE_DEPOSIT);

    // should not allow to deposit again
    await this.bob.bobMakesErc20Deposit(...params).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ETH deposit by revealing the secret', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      secretHash,
      lockTime
    ];

    // not allow to claim if deposit was not sent
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], zeroAddr).should.be.rejectedWith(EVMThrow);

    const depositTx = await this.bob.bobMakesEthDeposit(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // not allow to claim with invalid secret
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), txId, secretHash, accounts[1], zeroAddr).should.be.rejectedWith(EVMThrow);
    // not allow to claim wrong value
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('2'), secretHex, secretHash, accounts[1], zeroAddr).should.be.rejectedWith(EVMThrow);
    // not allow to claim from not Bob address
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], zeroAddr, { gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check bob balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[2].valueOf(), BOB_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], zeroAddr).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ERC20 deposit by revealing the secret', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      secretHash,
      this.token.address,
      lockTime
    ];

    // not allow to claim if deposit was not sent
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], this.token.address).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    const depositTx = await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;

    // not allow to claim with invalid secret
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), txId, secretHash, accounts[1], this.token.address).should.be.rejectedWith(EVMThrow);
    // not allow to claim wrong value
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('2'), secretHex, secretHash, accounts[1], this.token.address).should.be.rejectedWith(EVMThrow);
    // not allow to claim from not Bob address
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], this.token.address, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], this.token.address).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    // check bob balance
    assert.equal(balanceAfter.toString(), web3.utils.toWei('900'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[2].valueOf(), BOB_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], this.token.address).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ETH deposit after locktime expires', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      secretHash,
      lockTime
    ];

    // not allow to claim if deposit not sent
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.bob.bobMakesEthDeposit(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // not allow to claim before lock expires
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await await increaseTime(1000);
    // not allow bob to claim even by revealing correct secret
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], zeroAddr, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // not allow to claim from incorrect address
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, secretHash, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, secretHash, { from: accounts[1], gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[2].valueOf(), ALICE_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ERC deposit after locktime expires', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      secretHash,
      this.token.address,
      lockTime
    ];

    // not allow to claim if deposit not sent
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;

    // not allow to claim before timelock expires
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await await increaseTime(1000);
    // not allow bob to claim even by revealing correct secret
    await this.bob.bobClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, secretHash, accounts[1], this.token.address,{ from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // not allow to claim from incorrect address
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, secretHash, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    // check alice balance
    assert.equal(balanceAfter.toString(), web3.utils.toWei('101'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[2].valueOf(), ALICE_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.aliceClaimsDeposit(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ETH payment', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      lockTime
    ];
    await this.bob.bobMakesEthPayment(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    const payment = await this.bob.payments(txId);

    // locktime
    assert.equal(payment[1].valueOf(), lockTime);
    // status
    assert.equal(payment[2].valueOf(), BOB_MADE_PAYMENT);

    // should not allow to send payment again
    await this.bob.bobMakesEthPayment(...params, { value: web3.utils.toWei('1') }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ERC20 payment', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address,
      lockTime
    ];

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;

    //check contract token balance
    const balance = await this.token.balanceOf(this.bob.address);
    assert.equal(balance.toString(), web3.utils.toWei('1'));

    const payment = await this.bob.payments(txId);

    // locktime
    assert.equal(payment[1].valueOf(), lockTime);
    // status
    assert.equal(payment[2].valueOf(), BOB_MADE_PAYMENT);

    // should not allow to send payment again
    await this.bob.bobMakesErc20Payment(...params).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ETH payment by revealing a secret', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      lockTime
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.bob.bobMakesEthPayment(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), txId, accounts[0], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
    // should not allow to claim invalid amount
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('2'), secretHex, accounts[0], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from incorrect address
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, { from: accounts[1], gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[2].valueOf(), ALICE_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ERC20 payment by revealing a secret', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address,
      lockTime
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), txId, accounts[0], this.token.address, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from incorrect address
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);
    // check alice balance
    assert.equal(balanceAfter.toString(), web3.utils.toWei('101'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[2].valueOf(), ALICE_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ETH payment after locktime expires', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      accounts[1],
      secretHash,
      lockTime
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], zeroAddr, secretHash).should.be.rejectedWith(EVMThrow);

    await this.bob.bobMakesEthPayment(...params, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // should not allow to claim before locktime
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], zeroAddr, secretHash).should.be.rejectedWith(EVMThrow);

    await increaseTime(1000);
    // should not allow alice to claim even with valid secret
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], zeroAddr, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim invalid amount
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('2'), accounts[1], zeroAddr, secretHash).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], zeroAddr, secretHash, { gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[2].valueOf(), BOB_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], zeroAddr, secretHash).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ERC20 payment after locktime expires', async function () {
    const lockTime = await currentEvmTime() + 1000;
    const params = [
      txId,
      web3.utils.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address,
      lockTime
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.utils.toWei('1'));
    await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;

    // should not allow to claim before time lock expires
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    await increaseTime(1000);
    // should not allow alice to claim even with valid secret
    await this.bob.aliceClaimsPayment(txId, web3.utils.toWei('1'), secretHex, accounts[0], this.token.address, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim invalid amount
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('2'), accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], this.token.address, secretHash).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    // check bob balance
    assert.equal(balanceAfter.toString(), web3.utils.toWei('900'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[2].valueOf(), BOB_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.bobClaimsPayment(txId, web3.utils.toWei('1'), accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);
  });
});
