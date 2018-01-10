const Web3 = require('web3');
//const web3 = new Web3('https://ropsten.infura.io/y07GHxUyTgeN2mdfOonu');
const web3 = new Web3('wss://ropsten.infura.io/ws');

const abi = [{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"deals","outputs":[{"name":"initiator","type":"address"},{"name":"receiver","type":"address"},{"name":"tokenAddress","type":"address"},{"name":"amount","type":"uint256"},{"name":"claimUntilBlock","type":"uint256"},{"name":"state","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"etomicRelay","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_etomicTxId","type":"bytes32"}],"name":"receiverClaimsPayment","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_receiver","type":"address"},{"name":"_tokenAddress","type":"address"},{"name":"_amount","type":"uint256"}],"name":"initErc20Deal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"confirmDeal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"approveDeal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"initiatorClaimsPayment","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_receiver","type":"address"}],"name":"initEthDeal","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"blocksPerDeal","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_etomicRelay","type":"address"},{"name":"_blocksPerDeal","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dealId","type":"uint256"},{"indexed":true,"name":"etomicTxId","type":"bytes32"}],"name":"NeedDealApprove","type":"event"}];
const address = '0xE521f3DC3AB49Aa2E29741CD9c77B7656156f896';
const token = '0xc0eb7AeD740E1796992A08962c15661bDEB58003';
const receiver = '0x36514F29Bdcc5ee52E460d1BCb8e8f3B13d9F903';

async function initErc20Deal() {
  const contract = new web3.eth.Contract(abi, address);
  const method = contract.methods.initErc20Deal(2, receiver, token, web3.utils.toWei('1'));

  const txInput = {
    to: address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  return new Promise((resolve, reject) => {
    web3.eth.accounts.signTransaction(txInput, '0x10865c7c1046fc14437b96a45e83c4e768d1875aa5409c2b2d5f65b5e5dbcb91').then(transaction => {
      web3.eth.sendSignedTransaction(transaction.rawTransaction)
        .on('transactionHash', transactionHash => {
          resolve(transactionHash);
        })
        .on('error', (error) => {
          reject(error);
        })
        .catch((error) => {
          reject(error);
        })
        .then((receipt) => {
          console.log('deal initialized');
          console.log(receipt);
        });
    });
  });
}

initErc20Deal().then((hash) => {
  console.log(`finished: ${ hash }`);
});
