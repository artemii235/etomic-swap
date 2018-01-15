const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const config = require('../config');

async function method() {
  const contract = new web3.eth.Contract(config.alice.abi, config.alice.address);
  const method = contract.methods.aliceClaimsPayment(process.argv[2], process.argv[3]);

  const txInput = {
    to: config.alice.address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.ALICE_PK)
    .then(transaction => {
      web3.eth.sendSignedTransaction(transaction.rawTransaction)
        .on('transactionHash', transactionHash => {
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
          console.log('got receipt');
          console.log(receipt);
          process.exit();
        });
    });
}

method();
