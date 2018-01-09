const EtomicSwap = artifacts.require('EtomicSwap');
const Token = artifacts.require('Token');
const crypto = require('crypto');

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

const DEAL_UNINITIALIZED = 0;
const DEAL_INITIALIZED = 1;
const DEAL_PAYMENT_SENT_TO_RECEIVER = 2;
const DEAL_PAYMENT_SENT_TO_INITIATOR = 3;

const blocksPerDeal = 10;

contract('EtomicSwap', function(accounts) {

  beforeEach(async function () {
    this.etomicRelay = accounts[9];
    this.etomicSwap = await EtomicSwap.new(this.etomicRelay, blocksPerDeal);
    this.token = await Token.new();
    await this.token.transfer(accounts[1], web3.toWei('100'));
  });

  it('Should create contract with not initialized deals', async function () {
    const deal = await this.etomicSwap.deals(0);
    assert.equal(deal[5].valueOf(), DEAL_UNINITIALIZED);
  });

  it('Should allow to init ETH deal', async function () {
    const initParams = [
      0,
      accounts[1]
    ];
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    const deal = await this.etomicSwap.deals(0);
    // initiator
    assert.equal(deal[0], accounts[0]);
    // receiver
    assert.equal(deal[1], accounts[1]);
    // token address
    assert.equal(deal[2], 0);
    // amount
    assert.equal(deal[3].toString(), web3.toWei('1'));
    // claimUntilBlock
    assert.equal(deal[4].valueOf(), web3.eth.blockNumber + blocksPerDeal);
    // initialized status
    assert.equal(deal[5].valueOf(), DEAL_INITIALIZED);

    // should not allow to init again
    await this.etomicSwap.initEthDeal(...initParams, { value: 1 }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow to init using ERC20 token', async function () {
    const initParams = [
      0,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    const deal = await this.etomicSwap.deals(0);
    // initiator
    assert.equal(deal[0], accounts[0]);
    // receiver
    assert.equal(deal[1], accounts[1]);
    // token address
    assert.equal(deal[2], this.token.address);
    // amount
    assert.equal(deal[3].toString(), web3.toWei('1'));
    // claimUntilBlock
    assert.equal(deal[4].valueOf(), web3.eth.blockNumber + blocksPerDeal);
    // initialized status
    assert.equal(deal[5].valueOf(), DEAL_INITIALIZED);

    // check Etomic Swap contract token balance
    const balance = await this.token.balanceOf(this.etomicSwap.address);
    assert.equal(balance.toString(), web3.toWei('1'));

    // should not allow to init again
    await this.etomicSwap.initErc20Deal(...initParams).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow initiator to confirm ETH deal', async function () {
    const initParams = [
      0,
      accounts[1],
    ];

    // should not allow to confirm uninitialized deal
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init and confirm should work
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    const balanceBefore = web3.eth.getBalance(accounts[1]);
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[1]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // check receiver balance
    assert.equal(balanceAfter.sub(balanceBefore).toString(), web3.toWei('1'));

    // should not allow to confirm again
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow initiator to confirm ERC20 deal', async function () {
    const initParams = [
      0,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    // should not allow to confirm uninitialized deal
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // check receiver balance
    assert.equal(balanceAfter.toString(), web3.toWei('101'));

    // should not allow to confirm again
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow receiver to claim payment', async function () {
    const randomTxId = crypto.randomBytes(32).toString('binary');

    const initParams = [
      0,
      accounts[1]
    ];

    // should not allow to claim payment from uninitialized deal
    await this.etomicSwap.receiverClaimsPayment(0, randomTxId, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    await this.etomicSwap.receiverClaimsPayment(0, randomTxId, { from: accounts[1] }).should.be.fulfilled;
  });

  it('Should allow Etomic relay address to approve deal - ETH', async function () {
    const initParams = [
      0,
      accounts[1]
    ];

    // should not allow to approve uninitialized deal
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.rejectedWith(EVMThrow);

    // init
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    // should not allow to approve from address different from etomicRelay
    await this.etomicSwap.approveDeal(0, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    const balanceBefore = web3.eth.getBalance(accounts[1]);
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[1]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // check receiver balance
    assert.equal(balanceAfter.sub(balanceBefore).toString(), web3.toWei('1'));

    // should not allow to approve again
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow Etomic relay address to approve deal - ERC20', async function () {
    const initParams = [
      0,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    // should not allow to approve uninitialized deal
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to approve from address different from etomicRelay
    await this.etomicSwap.approveDeal(0, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // check receiver balance
    assert.equal(balanceAfter.toString(), web3.toWei('101'));

    // should not allow to approve again
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow initiator to claim payment ETH back when deal is expired', async function () {
    const initParams = [
      0,
      accounts[1],
    ];

    // should not allow to claim from uninitialized deal
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    // should not allow to claim if deal is not expired
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(web3.eth.blockNumber + blocksPerDeal);

    const balanceBefore = web3.eth.getBalance(accounts[0]);
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[0]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_INITIATOR);

    // check initiator balance
    assert.equal(balanceAfter.sub(balanceBefore).toString(), web3.toWei('0.9963703'));

    // should not allow to claim again
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow initiator to claim payment ERC20 back when deal is expired', async function () {
    const initParams = [
      0,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    // should not allow to claim from uninitialized deal
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to claim if deal is not expired
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(web3.eth.blockNumber + blocksPerDeal);

    // should not allow to confirm payment, claim by receiver, approve
    const randomTxId = crypto.randomBytes(32).toString('binary');
    await this.etomicSwap.approveDeal(0, { from: this.etomicRelay }).should.be.rejectedWith(EVMThrow);
    await this.etomicSwap.receiverClaimsPayment(0, randomTxId, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);
    await this.etomicSwap.confirmDeal(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    const deal = await this.etomicSwap.deals(0);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_INITIATOR);

    // check initiator balance
    assert.equal(balanceAfter.toString(), web3.toWei('900'));

    // should not allow to claim again
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });
});
