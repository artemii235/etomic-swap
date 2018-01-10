const Web3 = require('web3');
//const web3 = new Web3('https://ropsten.infura.io/y07GHxUyTgeN2mdfOonu');
const web3 = new Web3('wss://ropsten.infura.io/ws');

const abi = [{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"deals","outputs":[{"name":"initiator","type":"address"},{"name":"receiver","type":"address"},{"name":"tokenAddress","type":"address"},{"name":"amount","type":"uint256"},{"name":"claimUntilBlock","type":"uint256"},{"name":"state","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"etomicRelay","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_etomicTxId","type":"bytes32"}],"name":"receiverClaimsPayment","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_receiver","type":"address"},{"name":"_tokenAddress","type":"address"},{"name":"_amount","type":"uint256"}],"name":"initErc20Deal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"confirmDeal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"approveDeal","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"}],"name":"initiatorClaimsPayment","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_dealId","type":"uint256"},{"name":"_receiver","type":"address"}],"name":"initEthDeal","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"blocksPerDeal","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_etomicRelay","type":"address"},{"name":"_blocksPerDeal","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dealId","type":"uint256"},{"indexed":true,"name":"etomicTxId","type":"bytes32"}],"name":"NeedDealApprove","type":"event"}];
const address = '0x14A35C96517645E16D233333024dc31Bb2Ad9634';
const receiver = '0x36514F29Bdcc5ee52E460d1BCb8e8f3B13d9F903';

async function claimPayment() {
  const txId = '0x0631217099b72c9b708a92a4f74ff18344f4567ef5d008a845d06c3577181611';
  const contract = new web3.eth.Contract(abi, address);
  const method = contract.methods.receiverClaimsPayment(0, txId);

  const txInput = {
    to: address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  return new Promise((resolve, reject) => {
    web3.eth.accounts.signTransaction(txInput, '0x14a4ce854b7eea60e5ed46e9b9b42984ffb66c04891521344901db694348fcea').then(transaction => {
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
          process.exit();
        });
    });
  });
}

claimPayment().then((hash) => {
  console.log(`txHash: ${ hash }`);
});
