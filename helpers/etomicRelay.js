const Web3 = require('web3');
const web3 = new Web3(process.env.ETH_RPC_URL);
const rp = require('request-promise-native');
const config = require('./config');

const DEAL_INITIALIZED = 1;
const contract = new web3.eth.Contract(config.swapContract.abi, config.swapContract.address);

async function checkEvents() {
  const events = await contract.getPastEvents('NeedDealApprove', {fromBlock: config.initialBlock});
  for (let event of events) {
    const deal = await contract.methods.deals(event.returnValues.dealId).call();

    if (parseInt(deal[5], 10) !== DEAL_INITIALIZED) {
      continue;
    }

    const etomicTxId = event.returnValues.etomicTxId.replace('0x', '');
    const options = {
      uri: process.env.ETOMIC_RPC,
      method: 'POST',
      json: true,
      body: {
        jsonrpc: "1.0",
        id: "curltest",
        method: "getrawtransaction",
        params: [etomicTxId, 1]
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
      continue;
    }

    if (etomicTx) {
      const method = contract.methods.approveDeal(event.returnValues.dealId);
      const txInput = {
        to: config.swapContract.address,
        gas: 300000,
        gasPrice: web3.utils.toWei('100', 'gwei'),
        data: method.encodeABI()
      };

      const transaction = await web3.eth.accounts.signTransaction(txInput, process.env.ETOMIC_RELAY_PK);
      try {
        const receipt = await web3.eth.sendSignedTransaction(transaction.rawTransaction);
        console.log('deal approved');
        console.log(receipt);
      } catch (e) {
        console.log(e);
      }
    }
  }
  // check every 15 seconds - average Ethereum block time
  setTimeout(checkEvents, 15 * 1000);
}

// check for events every minute
checkEvents();
