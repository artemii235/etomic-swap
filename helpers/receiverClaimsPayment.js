const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const config = require('./config');

async function claimPayment() {
  const contract = new web3.eth.Contract(config.swapContract.abi, config.swapContract.address);
  const method = contract.methods.receiverClaimsPayment(process.argv[2], process.argv[3]);

  const txInput = {
    to: config.swapContract.address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.RECEIVER_PK)
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
          console.log('transaction confirmed');
          console.log(receipt);
          process.exit();
        });
    });
}

claimPayment();
