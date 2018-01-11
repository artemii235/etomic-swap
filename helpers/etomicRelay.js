const Web3 = require('web3');
const web3 = new Web3('wss://ropsten.infura.io/ws');
const rp = require('request-promise-native');
const config = require('./config');

async function listenForEvents() {
  const contract = new web3.eth.Contract(config.swapContract.abi, config.swapContract.address);
  contract.events.NeedDealApprove()
    .on('data', async (data) => {
      console.log(data);
      const txId = data.returnValues.etomicTxId.replace('0x', '');

      const options = {
        uri: process.env.ETOMIC_RPC,
        method: 'POST',
        json: true,
        body: {
          jsonrpc: "1.0",
          id: "curltest",
          method: "getrawtransaction",
          params: [txId, 1]
        },
        auth: {
          user: process.env.ETOMIC_USER,
          password: process.env.ETOMIC_PASSWORD
        }
      };

      let etomicTx;
      try {
        etomicTx = await rp(options);
      } catch (e) {
        console.log(e);
        return;
      }

      if (etomicTx) {
        const method = contract.methods.approveDeal(data.returnValues.dealId);
        const txInput = {
          to: config.swapContract.address,
          gas: 300000,
          gasPrice: web3.utils.toWei('100', 'gwei'),
          data: method.encodeABI()
        };

        web3.eth.accounts.signTransaction(txInput, process.env.ETOMIC_RELAY_PK).then((transaction) => {
          web3.eth.sendSignedTransaction(transaction.rawTransaction)
            .on('transactionHash', transactionHash => {
              console.log(`approve deal txHash: ${ transactionHash }`);
            })
            .on('error', (error) => {
              console.log('approve error');
              console.log(error);
            })
            .catch((error) => {
              console.log('approve error');
              console.log(error);
            })
            .then((receipt) => {
              console.log('deal approved');
              console.log(receipt);
            });
        });
      }
    });
}

listenForEvents();
