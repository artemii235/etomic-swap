const rp = require('request-promise-native');

const options = {
  uri: 'http://172.20.0.1:10271/',
  method: 'POST',
  json: true,
  body: {
    jsonrpc: "1.0",
    id: "curltest",
    method: "getrawtransaction",
    params: ["0631217099b72c9b708a92a4f74ff18344f4567ef5d008a845d06c3577181611", 1]
  },
  auth: {
    user: 'user481805103',
    password: 'pass97a61c8d048bcf468c6c39a314970e557f57afd1d8a5edee917fb29bafb3a43371'
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
