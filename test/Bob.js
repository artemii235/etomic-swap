const Bob = artifacts.require('Bob');
const Token = artifacts.require('Token');
const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const EVMThrow = 'VM Exception while processing transaction';

require('chai')
  .use(require('chai-as-promised'))
  .should();

function advanceBlock () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: Date.now(),
    }, (err, res) => {
      return err ? reject(err) : resolve(res);
    });
  });
}

// Advances the block number so that the last mined block is `number`.
async function advanceToBlock (number) {
  if (web3.eth.blockNumber > number) {
    throw Error(`block number ${number} is in the past (current is ${ web3.eth.blockNumber })`);
  }

  while (web3.eth.blockNumber < number) {
    await advanceBlock();
  }
}

const blocksPerDeal = 10;
const txId = '0x' + crypto.randomBytes(32).toString('hex');
const [DEPOSIT_UNINITIALIZED, BOB_MADE_DEPOSIT, ALICE_CLAIMED_DEPOSIT, BOB_CLAIMED_DEPOSIT] = [0, 1, 2, 3];
const [PAYMENT_UNINITIALIZED, BOB_MADE_PAYMENT, ALICE_CLAIMED_PAYMENT, BOB_CLAIMED_PAYMENT] = [0, 1, 2, 3];

const secret = crypto.randomBytes(32);
const secretHash = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(secret).digest()).digest('hex');
const secretHex = '0x' + secret.toString('hex');

contract('Bob', function(accounts) {

  beforeEach(async function () {
    this.bob = await Bob.new(blocksPerDeal);
    this.token = await Token.new();
    await this.token.transfer(accounts[1], web3.toWei('100'));
  });

  it('should create contract with uninitialized deposits and payments', async function () {
    const deposit = await this.bob.deposits(txId);
    assert.equal(deposit[1].valueOf(), DEPOSIT_UNINITIALIZED);
    const payment = await this.bob.payments(txId);
    assert.equal(payment[1].valueOf(), PAYMENT_UNINITIALIZED);
  });

  it('should allow Bob to make ETH deposit', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];
    await this.bob.bobMakesEthDeposit(...params, { value: web3.toWei('1') }).should.be.fulfilled;

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), BOB_MADE_DEPOSIT);

    // should not allow to deposit again
    await this.bob.bobMakesEthDeposit(...params, { value: web3.toWei('1') }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ERC20 deposit', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    await this.token.approve(this.bob.address, web3.toWei('1'));
    await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;

    //check contract token balance
    const balance = await this.token.balanceOf(this.bob.address);
    assert.equal(balance.toString(), web3.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), BOB_MADE_DEPOSIT);

    // should not allow to deposit again
    await this.bob.bobMakesErc20Deposit(...params).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ETH deposit by revealing the secret', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];

    // not allow to claim if deposit was not sent
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[1], '0x0', secretHex).should.be.rejectedWith(EVMThrow);

    const depositTx = await this.bob.bobMakesEthDeposit(...params, { value: web3.toWei('1') }).should.be.fulfilled;
    const aliceCanClaimAfter = depositTx.receipt.blockNumber + blocksPerDeal * 2;

    // not allow to claim with invalid secret
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], '0x0', txId).should.be.rejectedWith(EVMThrow);
    // not allow to claim wrong value
    await this.bob.bobClaimsDeposit(txId, web3.toWei('2'), aliceCanClaimAfter, accounts[1], '0x0', secretHex).should.be.rejectedWith(EVMThrow);
    // not allow to claim from not Bob address
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], '0x0', secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
    // not allow to claim with wrong aliceClaimAfter value
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter + 1, accounts[1], '0x0', secretHex).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.eth.getBalance(accounts[0]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], '0x0', secretHex).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[0]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check bob balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), BOB_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], '0x0', secretHex).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ERC20 deposit by revealing the secret', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    // not allow to claim if deposit was not sent
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[1], this.token.address, secretHex).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.toWei('1'));
    const depositTx = await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;
    const aliceCanClaimAfter = depositTx.receipt.blockNumber + blocksPerDeal * 2;

    // not allow to claim with invalid secret
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], this.token.address, txId).should.be.rejectedWith(EVMThrow);
    // not allow to claim wrong value
    await this.bob.bobClaimsDeposit(txId, web3.toWei('2'), aliceCanClaimAfter, accounts[1], this.token.address, secretHex).should.be.rejectedWith(EVMThrow);
    // not allow to claim from not Bob address
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], this.token.address, secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
    // not allow to claim with wrong aliceClaimAfter value
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter + 1, accounts[1], this.token.address, secretHex).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], this.token.address, secretHex).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    // check bob balance
    assert.equal(balanceAfter.toString(), web3.toWei('900'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), BOB_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], this.token.address, secretHex).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ETH deposit after aliceCanClaimAfter block', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];

    // not allow to claim if deposit not sent
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[0], '0x0', secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    const depositTx = await this.bob.bobMakesEthDeposit(...params, { value: web3.toWei('1') }).should.be.fulfilled;
    const aliceCanClaimAfter = depositTx.receipt.blockNumber + blocksPerDeal * 2;
    // not allow to claim with incorrect aliceClaimAfter value
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber - 1, accounts[0], '0x0', secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(aliceCanClaimAfter - 2);
    // not allow to claim before aliceCanClaimAfter
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], '0x0', secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // not allow bob to claim even by revealing correct secret
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], '0x0', secretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // not allow to claim from incorrect address
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], '0x0', secretHash, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.eth.getBalance(accounts[1]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], '0x0', secretHash, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[1]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), ALICE_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], '0x0', secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ERC deposit after aliceCanClaimAfter block', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    // not allow to claim if deposit not sent
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.toWei('1'));
    const depositTx = await this.bob.bobMakesErc20Deposit(...params).should.be.fulfilled;
    const aliceCanClaimAfter = depositTx.receipt.blockNumber + blocksPerDeal * 2;

    // not allow to claim with incorrect aliceClaimAfter value
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), web3.eth.blockNumber - 1, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(aliceCanClaimAfter - 2);
    // not allow to claim before aliceCanClaimAfter
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // not allow bob to claim even by revealing correct secret
    await this.bob.bobClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[1], this.token.address, secretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // not allow to claim from incorrect address
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], this.token.address, secretHash, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    // check alice balance
    assert.equal(balanceAfter.toString(), web3.toWei('101'));

    const deposit = await this.bob.deposits(txId);

    // status
    assert.equal(deposit[1].valueOf(), ALICE_CLAIMED_DEPOSIT);

    // should not allow to claim again
    await this.bob.aliceClaimsDeposit(txId, web3.toWei('1'), aliceCanClaimAfter, accounts[0], this.token.address, secretHash, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ETH payment', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];
    await this.bob.bobMakesEthPayment(...params, { value: web3.toWei('1') }).should.be.fulfilled;

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), BOB_MADE_PAYMENT);

    // should not allow to send payment again
    await this.bob.bobMakesEthPayment(...params, { value: web3.toWei('1') }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to make ERC20 payment', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    await this.token.approve(this.bob.address, web3.toWei('1'));
    await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;

    //check contract token balance
    const balance = await this.token.balanceOf(this.bob.address);
    assert.equal(balance.toString(), web3.toWei('1'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), BOB_MADE_PAYMENT);

    // should not allow to send payment again
    await this.bob.bobMakesErc20Payment(...params).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ETH payment by revealing a secret', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[0], '0x0', secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    const paymentTx = await this.bob.bobMakesEthPayment(...params, { value: web3.toWei('1') }).should.be.fulfilled;
    const bobCanClaimAfter = paymentTx.receipt.blockNumber + blocksPerDeal;

    // should not allow to claim with invalid secret
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], '0x0', txId, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
    // should not allow to claim invalid amount
    await this.bob.aliceClaimsPayment(txId, web3.toWei('2'), bobCanClaimAfter, accounts[0], '0x0', secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from incorrect address
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], '0x0', secretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.eth.getBalance(accounts[1]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], '0x0', secretHex, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[1]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), ALICE_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], '0x0', secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Alice to claim ERC20 payment by revealing a secret', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[0], this.token.address, secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.toWei('1'));
    const paymentTx = await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;
    const bobCanClaimAfter = paymentTx.receipt.blockNumber + blocksPerDeal;

    // should not allow to claim with invalid secret
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], this.token.address, txId, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from incorrect address
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], this.token.address, secretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], this.token.address, secretHex, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);
    // check alice balance
    assert.equal(balanceAfter.toString(), web3.toWei('101'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), ALICE_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], this.token.address, secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ETH payment after bobCanClaimAfter block', async function () {
    const params = [
      txId,
      accounts[1],
      secretHash
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[1], '0x0', secretHash).should.be.rejectedWith(EVMThrow);

    const paymentTx = await this.bob.bobMakesEthPayment(...params, { value: web3.toWei('1') }).should.be.fulfilled;
    const bobCanClaimAfter = paymentTx.receipt.blockNumber + blocksPerDeal;

    // not allow to claim with invalid bobCanClaimAfterBlock
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter - 100, accounts[1], '0x0', secretHash).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(bobCanClaimAfter - 2);
    // should not allow to claim before bobCanClaimAfter
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], '0x0', secretHash).should.be.rejectedWith(EVMThrow);

    // should not allow alice to claim even with valid secret
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], '0x0', secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim invalid amount
    await this.bob.bobClaimsPayment(txId, web3.toWei('2'), bobCanClaimAfter, accounts[1], '0x0', secretHash).should.be.rejectedWith(EVMThrow);

    // success claim
    const balanceBefore = web3.eth.getBalance(accounts[0]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], '0x0', secretHash).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[0]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check alice balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), BOB_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], '0x0', secretHash).should.be.rejectedWith(EVMThrow);
  });

  it('should allow Bob to claim ERC20 payment after bobCanClaimAfter block', async function () {
    const params = [
      txId,
      web3.toWei('1'),
      accounts[1],
      secretHash,
      this.token.address
    ];

    // should not allow to claim from uninitialized payment
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), web3.eth.blockNumber, accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    await this.token.approve(this.bob.address, web3.toWei('1'));
    const paymentTx = await this.bob.bobMakesErc20Payment(...params).should.be.fulfilled;
    const bobCanClaimAfter = paymentTx.receipt.blockNumber + blocksPerDeal;

    // not allow to claim with invalid bobCanClaimAfterBlock
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter - 100, accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(bobCanClaimAfter - 2);
    // should not allow to claim before bobCanClaimAfter
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    // should not allow alice to claim even with valid secret
    await this.bob.aliceClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[0], this.token.address, secretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim invalid amount
    await this.bob.bobClaimsPayment(txId, web3.toWei('2'), bobCanClaimAfter, accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);

    // success claim
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], this.token.address, secretHash).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    // check bob balance
    assert.equal(balanceAfter.toString(), web3.toWei('900'));

    const payment = await this.bob.payments(txId);

    // status
    assert.equal(payment[1].valueOf(), BOB_CLAIMED_PAYMENT);

    // should not allow to claim again
    await this.bob.bobClaimsPayment(txId, web3.toWei('1'), bobCanClaimAfter, accounts[1], this.token.address, secretHash).should.be.rejectedWith(EVMThrow);
  });
});
