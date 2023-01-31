module.exports = {
  networks: {
    development: {
      host: "rpc",
      port: 8545,
      network_id: "*" // Match any network id
    }
  },
  compilers: {
    solc: {
      version: "0.8.17",   
    }
  },
};
