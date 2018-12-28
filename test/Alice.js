const Alice = artifacts.require('Alice');
const Token = artifacts.require('Token');
const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');

const EVMThrow = 'VM Exception while processing transaction';

require('chai')
  .use(require('chai-as-promised'))
  .should();

const [ DEAL_UNINITIALIZED, DEAL_INITIALIZED, DEAL_PAYMENT_SENT_TO_BOB, DEAL_PAYMENT_SENT_TO_ALICE] = [0, 1, 2, 3];

const aliceSecret = crypto.randomBytes(32);
const aliceHash = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(aliceSecret).digest()).digest('hex');
const bobSecret = crypto.randomBytes(32);
const bobHash = '0x' + new RIPEMD160().update(crypto.createHash('sha256').update(bobSecret).digest()).digest('hex');
const dealId = '0x' + crypto.randomBytes(32).toString('hex');
const aliceSecretHex = '0x' + aliceSecret.toString('hex');
const bobSecretHex = '0x' + bobSecret.toString('hex');

const zeroAddr = '0x0000000000000000000000000000000000000000';

contract('Alice', function(accounts) {

  beforeEach(async function () {
    this.alice = await Alice.new();
    this.token = await Token.new();
    this.wrongToken = await Token.new();
    await this.token.transfer(accounts[1], web3.utils.toWei('100'));
  });

  it('Should create contract with not initialized deals', async function () {
    const deal = await this.alice.deals(dealId);
    assert.equal(deal[1].valueOf(), DEAL_UNINITIALIZED);
  });

  it('Should allow to init ETH deal', async function () {
    const initParams = [
      dealId,
      accounts[1],
      aliceHash,
      bobHash
    ];
    await this.alice.initEthDeal(...initParams, { value: web3.utils.toWei('1') }).should.be.fulfilled;
    const deal = await this.alice.deals(dealId);

    assert.equal(deal[1].valueOf(), DEAL_INITIALIZED);

    // should not allow to init again
    await this.alice.initEthDeal(...initParams, { value: 1 }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow to init using ERC20 token', async function () {
    const initParams = [
      dealId,
      web3.utils.toWei('1'),
      accounts[1],
      aliceHash,
      bobHash,
      this.token.address
    ];

    await this.token.approve(this.alice.address, web3.utils.toWei('1'), { from: accounts[0] });
    await this.alice.initErc20Deal(...initParams).should.be.fulfilled;

    const deal = await this.alice.deals(dealId);
    // initialized status
    assert.equal(deal[1].valueOf(), DEAL_INITIALIZED);

    // check Alice contract token balance
    const balance = await this.token.balanceOf(this.alice.address);
    assert.equal(balance.toString(), web3.utils.toWei('1'));

    // should not allow to init again
    await this.alice.initErc20Deal(...initParams).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow Bob to claim and receive ETH payment using Alice secret', async function () {
    const initParams = [
      dealId,
      accounts[1],
      aliceHash,
      bobHash
    ];

    // should not allow to claim payment from uninitialized deal
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.alice.initEthDeal(...initParams, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[0], bobHash, bobSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim wrong amount
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('2'), zeroAddr, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from address not equal to bob
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[0], bobHash, aliceSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[0], bobHash, aliceSecretHex, { from: accounts[1], gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check receiver balance - correct amount should be sent
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const deal = await this.alice.deals(dealId);
    // check payment sent status
    assert.equal(deal[1].valueOf(), DEAL_PAYMENT_SENT_TO_BOB);

    // should not allow to claim again
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);;
  });

  it('Should allow Bob to claim and receive ERC20 payment using Alice secret', async function () {
    const initParams = [
      dealId,
      web3.utils.toWei('1'),
      accounts[1],
      aliceHash,
      bobHash,
      this.token.address
    ];

    // should not allow to claim payment from uninitialized deal
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.alice.address, web3.utils.toWei('1'), { from: accounts[0] });
    await this.alice.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[0], bobHash, bobSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from address not equal to bob
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[0], bobHash, aliceSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim invalid amount
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('2'), this.token.address, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[1]);

    // check bob balance - correct amount should be sent
    assert.equal(balanceAfter.toString(), web3.utils.toWei('101'));

    const deal = await this.alice.deals(dealId);
    // check payment sent status
    assert.equal(deal[1].valueOf(), DEAL_PAYMENT_SENT_TO_BOB);

    // should not allow to claim again
    await this.alice.bobClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[0], bobHash, aliceSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);;
  });

  it('Should allow Alice claim ETH payment using Bob secret', async function () {
    const initParams = [
      dealId,
      accounts[1],
      aliceHash,
      bobHash
    ];

    // should not allow to claim from uninitialized deal
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.alice.initEthDeal(...initParams, { value: web3.utils.toWei('1') }).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[1], aliceHash, aliceSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from non-Alice address
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[1], aliceHash, bobSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim wrong amount
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('2'), zeroAddr, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    // default ganache-cli gas price
    const gasPrice = web3.utils.toWei('100', 'gwei');
    const tx = await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[1], aliceHash, bobSecretHex, { from: accounts[0], gasPrice }).should.be.fulfilled;
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    const txFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(tx.receipt.gasUsed));
    // check initiator balance
    assert.equal(balanceAfter.sub(balanceBefore).add(txFee).toString(), web3.utils.toWei('1'));

    const deal = await this.alice.deals(dealId);
    // check payment sent status
    assert.equal(deal[1].valueOf(), DEAL_PAYMENT_SENT_TO_ALICE);

    // should not allow to claim again
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), zeroAddr, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });

  it('Should allow Alice to claim payment ERC20 using Bob secret', async function () {
    const initParams = [
      dealId,
      web3.utils.toWei('1'),
      accounts[1],
      aliceHash,
      bobHash,
      this.token.address
    ];

    // should not allow to claim from uninitialized deal
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // init
    await this.token.approve(this.alice.address, web3.utils.toWei('1'), { from: accounts[0] });
    await this.alice.initErc20Deal(...initParams).should.be.fulfilled;

    // should not allow to claim with invalid secret
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[1], aliceHash, aliceSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim from non-Alice address
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[1] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim wrong amount
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('2'), this.token.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    // should not allow to claim wrong token
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.wrongToken.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);

    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(accounts[0]);

    const deal = await this.alice.deals(dealId);
    // check confirmed status
    assert.equal(deal[1].valueOf(), DEAL_PAYMENT_SENT_TO_ALICE);

    // check initiator balance
    assert.equal(balanceAfter.toString(), web3.utils.toWei('900'));

    // should not allow to claim again
    await this.alice.aliceClaimsPayment(dealId, web3.utils.toWei('1'), this.token.address, accounts[1], aliceHash, bobSecretHex, { from: accounts[0] }).should.be.rejectedWith(EVMThrow);
  });
});
