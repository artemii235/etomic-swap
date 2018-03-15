# Etomic Swap Smart Contracts for BarterDex platform.
[![Build Status](https://travis-ci.org/artemii235/etomic-swap.svg?branch=master)](https://travis-ci.org/artemii235/etomic-swap)  
Etomic swap Smart Contracts are implemented to support ETH and ERC20 atomic swaps on BarterDex platform.
Please note that this project is not production ready yet!

## Swap workflow
Smart Contracts follow BarterDex Atomic swap protocol https://github.com/SuperNETorg/komodo/wiki/barterDEX-Whitepaper-v2#atomic-swaps  
Despite example shows swap of ETH/ERC20 this approach will work also for ETH/ERC20 swaps to any currency supporting HTLC and multisigs.  

1. Bob wants to change his 1 ETH to Alice 1 ERC20 token.
1. Alice and Bob generate temporary Private/Public key pairs required to execute the swap.
1. Alice sends dexfee (handled externally by client side)
1. Bob sends deposit locked with his hash of BsecretN. He will need to reveal BsecretN to claim it back. Alice can claim deposit without knowing a secret after 4 hours.
1. Alice sends payment locked with 2 hashes: AsecretM and BsecretN.
1. Bob sends payment locked with hash of AsecretM. Bob can claim payment back after 2 hours without knowing AsecretM.
1. Alice claims Bob payment revealing AsecretM.
1. Bob claims Alice payment using AsecretM.
1. Bob claims his deposit back.

## Project structure

1. `contracts` - Smart Contracts source code.
1. `helpers` - NodeJS command line scripts helping to deploy/interact with Smart Contracts.
1. `test` - Smart contracts unit tests.

## How to setup dev environment?

1. Install docker.
1. Run `docker-compose build`.
1. `cp .env.empty .env`.
1. Start containers `docker-compose up -d`.
1. Install project dependencies: `docker-compose exec workspace yarn`.
1. To run tests: `docker-compose exec workspace truffle test`.
1. To run helper scripts set `ALICE_PK`, `BOB_PK` in .env file. These variables should contain valid Ethereum private keys - these keys stay at your local machine, however it's not recommended to put keys having access to real money.

## Related links

1. Komodo platform - https://www.komodoplatform.com
1. BarterDex - https://www.komodoplatform.com/en/technology/barterdex

## Useful links for smart contracts development

1. Truffle suite - https://github.com/trufflesuite/truffle
1. Ganache-cli (EthereumJS Testrpc) - https://github.com/trufflesuite/ganache-cli
1. Zeppelin Solidity - https://github.com/OpenZeppelin/zeppelin-solidity
