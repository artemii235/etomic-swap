const Web3 = require('web3');
const config = require('../config');

const web3 = new Web3(process.env.ETH_RPC_URL);

function initEthDeal() {
  const contract = new web3.eth.Contract(config.alice.abi, config.alice.address);
  // get deal id and hashes from command line
  const method = contract.methods.initEthDeal(process.argv[2], config.deal.bob, process.argv[3], process.argv[4]);

  const txInput = {
    to: config.alice.address,
    value: web3.utils.toWei('1'),
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.ALICE_PK)
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