# Etomic Swap Smart Contracts for BarterDex platform.
[![Build Status](https://travis-ci.org/artemii235/etomic-swap.svg?branch=master)](https://travis-ci.org/artemii235/etomic-swap)  
Etomic swap Smart Contract is implemented to support ETH and ERC20 atomic swaps on AtomicDex platform.
Please note that this project is not production ready yet!

## Swap workflow
Smart Contracts follow standard symmetric Atomic swap protocol.  
Despite example shows swap of ETH/ERC20 this approach will work also for ETH/ERC20 swaps to any currency supporting HTLC (https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts).  

1. Bob wants to change his 1 ETH to Alice 1 ERC20 token.
1. Alice sends dexfee (handled externally by client side).
1. Bob sends payment locked with hash of the Secret. He can refund the payment in 4 hours.
1. Alice sends payment locked with Bob Secret hash. She can refund her payment in 2 hours.
1. Bob spends Alice payment by revealing the secret.
1. Alice spends Bob payment using revealed secret.

## Project structure

1. `contracts` - Smart Contracts source code.
1. `test` - Smart contracts unit tests.

## How to setup dev environment?

1. Install docker.
1. Run `docker-compose build`.
1. Start containers `docker-compose up -d`.
1. Install project dependencies: `docker-compose exec workspace yarn`.
1. To run tests: `docker-compose exec workspace truffle test`.

## Related links

1. Komodo platform - https://www.komodoplatform.com
1. AtomicDEX - https://atomicdex.io

## Useful links for smart contracts development

1. Truffle suite - https://github.com/trufflesuite/truffle
1. Ganache-cli (EthereumJS Testrpc) - https://github.com/trufflesuite/ganache-cli
1. Zeppelin Solidity - https://github.com/OpenZeppelin/zeppelin-solidity
