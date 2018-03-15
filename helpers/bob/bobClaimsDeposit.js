const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const config = require('../config');

async function method() {
  const contract = new web3.eth.Contract(config.bob.abi, config.bob.address);
  const method = contract.methods.bobClaimsDeposit(
    process.argv[2],
    web3.utils.toWei('1'),
    process.argv[3],
    config.deal.alice,
    process.argv[4]
  );

  const txInput = {
    to: config.bob.address,
    gas: 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: method.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.BOB_PK)
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
