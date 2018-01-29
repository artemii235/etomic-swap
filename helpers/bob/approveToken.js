const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const config = require('../config');

async function approveToken() {
  const contract = new web3.eth.Contract(config.tokenContract.abi, config.tokenContract.address);
  const method = contract.methods.approve(config.bob.address, web3.utils.toWei('100'));

  const txInput = {
    to: config.tokenContract.address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.BOB_PK)
    .then((transaction) => {
      web3.eth.sendSignedTransaction(transaction.rawTransaction)
        .on('transactionHash', (transactionHash) => {
          console.log(`txHash: ${ transactionHash }`);
        })
        .on('error', (error) => {
          console.log(error);
        })
        .catch((error) => {
          console.log(error);
        })
        .then((receipt) => {
          console.log('token allowance approved');
          console.log(receipt);
          process.exit();
        });
    });
}

approveToken();