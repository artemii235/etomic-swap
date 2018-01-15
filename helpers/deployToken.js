const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const config = require('./config');

async function deploy() {
  const contract = new web3.eth.Contract(config.tokenContract.abi);

  const deploy = contract.deploy({
    data: config.tokenContract.byteCode
  });

  const txInput = {
    to: null,
    amount: '0',
    gas: (await deploy.estimateGas()) + 300000,
    gasPrice: web3.utils.toWei('100', 'gwei'),
    data: deploy.encodeABI()
  };

  web3.eth.accounts.signTransaction(txInput, process.env.ALICE_PK).then(transaction => {
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
        console.log('token contract deployed');
        console.log(receipt);
        process.exit();
      });
  });
}

deploy();