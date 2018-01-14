const EtomicSwap = artifacts.require('EtomicSwap');
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

const DEAL_UNINITIALIZED = 0;
const DEAL_INITIALIZED = 1;
const DEAL_PAYMENT_SENT_TO_RECEIVER = 2;
const DEAL_PAYMENT_SENT_TO_INITIATOR = 3;

const blocksPerDeal = 10;
const validSecret = crypto.randomBytes(32).toString('hex');
const invalidSecret = crypto.randomBytes(32).toString('hex');
const dealId = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(validSecret).digest()).digest('hex');

contract('EtomicSwap', function(accounts) {

  beforeEach(async function () {
    this.etomicSwap = await EtomicSwap.new(blocksPerDeal);
    this.token = await Token.new();
    await this.token.transfer(accounts[1], web3.toWei('100'));
  });

  it('Should create contract with not initialized deals', async function () {
    const deal = await this.etomicSwap.deals(dealId);
    assert.equal(deal[5].valueOf(), DEAL_UNINITIALIZED);
  });

  it('Should allow to init ETH deal', async function () {
    const initParams = [
      dealId,
      accounts[1]
    ];
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    const deal = await this.etomicSwap.deals(dealId);
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
      dealId,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    const deal = await this.etomicSwap.deals(dealId);
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

  it('Should allow receiver to claim and receive ETH payment', async function () {
    const initParams = [
      dealId,
      accounts[1]
    ];

    // should not allow to claim payment from uninitialized deal
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.etomicSwap.receiverClaimsPayment(dealId, invalidSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from address not equal to receiver
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    const balanceBefore = web3.eth.getBalance(accounts[1]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[1]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check receiver balance - correct amount should be sent
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const deal = await this.etomicSwap.deals(dealId);
    // check payment sent status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // should not allow to claim again
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);;
  });

  it('Should allow receiver to claim and receive ERC20 payment', async function () {
    const initParams = [
      dealId,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    // should not allow to claim payment from uninitialized deal
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.etomicSwap.receiverClaimsPayment(dealId, invalidSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from address not equal to receiver
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    // check receiver balance - correct amount should be sent
    assert.equal(balanceAfter.toString(), web3.toWei('101'));

    const deal = await this.etomicSwap.deals(dealId);
    // check payment sent status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_RECEIVER);

    // should not allow to claim again
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);;
  });

  it('Should allow initiator to claim payment ETH back when deal is expired', async function () {
    const initParams = [
      dealId,
      accounts[1],
    ];

    // should not allow to claim from uninitialized deal
    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.etomicSwap.initEthDeal(...initParams, { value: web3.toWei('1') }).should.be.fulfilled;

    // should not allow to claim if deal is not expired
    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(web3.eth.blockNumber + blocksPerDeal);

    const balanceBefore = web3.eth.getBalance(accounts[0]);

    // default ganache-cli gas price
    const gasPrice = web3.toWei('100', 'gwei');
    const tx = await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = web3.eth.getBalance(accounts[0]);

    const txFee = web3.toBigNumber(gasPrice).mul(web3.toBigNumber(tx.receipt.gasUsed));
    // check initiator balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.toWei('1'));

    const deal = await this.etomicSwap.deals(dealId);
    // check payment sent status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_INITIATOR);

    // should not allow to claim again
    await this.etomicSwap.initiatorClaimsPayment(0, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow initiator to claim payment ERC20 back when deal is expired', async function () {
    const initParams = [
      dealId,
      accounts[1],
      this.token.address,
      web3.toWei('1')
    ];

    // should not allow to claim from uninitialized deal
    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.etomicSwap.address, web3.toWei('1'), { from: accounts[0] });
    await this.etomicSwap.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to claim if deal is not expired
    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await advanceToBlock(web3.eth.blockNumber + blocksPerDeal);

    // should not allow to claim by receiver
    await this.etomicSwap.receiverClaimsPayment(dealId, validSecret, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    const deal = await this.etomicSwap.deals(dealId);
    // check confirmed status
    assert.equal(deal[5].valueOf(), DEAL_PAYMENT_SENT_TO_INITIATOR);

    // check initiator balance
    assert.equal(balanceAfter.toString(), web3.toWei('900'));

    // should not allow to claim again
    await this.etomicSwap.initiatorClaimsPayment(dealId, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });
});
