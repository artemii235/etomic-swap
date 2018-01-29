const Web3 = require('web3');
const config = require('../config');

const web3 = new Web3(process.env.ETH_RPC_URL);

function initEthDeal() {
  const contract = new web3.eth.Contract(config.bob.abi, config.bob.address);
  // get deal id and hashes from command line
  const method = contract.methods.bobMakesErc20Payment(
    process.argv[2],
    web3.utils.toWei('1'),
    config.deal.alice,
    process.argv[3],
    config.tokenContract.address
  );

  const txInput = {
    to: config.bob.address,
    value: 0,
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
          process.exit();
        })
        .catch((error) => {
          console.log(error);
          process.exit();
        })
        .then((receipt) => {
          console.log('deposit made');
          console.log(receipt);
          process.exit();
        });
    });
}

initEthDeal();