const Web3 = require('web3');
const config = require('./config');

const web3 = new Web3('wss://ropsten.infura.io/ws');

function initEthDeal() {
  const contract = new web3.eth.Contract(config.swapContract.abi, config.swapContract.address);
  // get deal id from command line
  const method = contract.methods.initEthDeal(process.argv[2], config.deal.receiver);

  const txInput = {
    to: config.swapContract.address,
    value: web3.utils.toWei('1'),
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.INITIATOR_PK)
    .then((transaction) => {
      web3.eth.sendSignedTransaction(transaction.rawTransaction)
        .on('transactionHash', (transactionHash) => {
          console.log(`txHash: ${ transactionHash }`);
        })
        .on('error', (error) => {
          console.log(error);
          process.exit();
        })
        .catch((error) => {
          console.log(error);
          process.exit();
        })
        .then((receipt) => {
          console.log('deal initialized');
          console.log(receipt);
          process.exit();
        });
    });
}

initEthDeal();