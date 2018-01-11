const rp = require('request-promise-native');

const options = {
  uri: process.env.ETOMIC_RPC,
  method: 'POST',
  json: true,
  body: {
    jsonrpc: "1.0",
    id: "curltest",
    method: "getrawtransaction",
    params: ["0631217099b72c9b708a92a4f74ff18344f4567ef5d008a845d06c3577181611", 1]
  },
  auth: {
    user: process.env.ETOMIC_USER,
    password: process.env.ETOMIC_PASSWORD
  }
};

rp(options)
  .then(function (response) {
    console.log(response);
    process.exit();
  })
  .catch(function (error) {
    console.log(error);
    process.exit();
  });
