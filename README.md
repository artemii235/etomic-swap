# Etomic Swap Smart Contract for BarterDex platform.
Etomic swap Smart Contract is implemented to support ETH and ERC20 atomic swaps on BarterDex platform.
Please note that this project is not production ready yet!

## Swap workflow

1. Definition: ESSC - Etomic Swap Smart Contract 
1. Let's expect that 1 ETH = 1 ETOMIC = 1 KMD.
1. Alice has 1 ETOMIC and 1 ETH/ERC20 token. Bob has 1 KMD.
1. If ERC20 swap is going to be performed Alice must allow ESSC to `transferFrom` her 1 ERC20 token executing `approve` ERC20 method. 
1. Alice and Bob initiate swap according to BarterDex Atomic Swap protocol: https://github.com/SuperNETorg/komodo/wiki/barterDEX-Whitepaper-v2#atomic-swaps. Alice also executes `initDeal` ESSC method making ETH/ERC20 payment which is locked by ESSC.
1. Once BarterDex Swap protocol completes Alice executes `confirmDeal` ESSC method and her deposit is being transferred to Bob.
1. If Alice is not nice and not confirming the deal - Bob can request manual approval from Etomic relay - relay will check that provided txid exists and spent to right address and approve payment to Bob.
1. If Alice is not confirming the payment and Bob is not getting approved during timelock period - Alice can take her payment back.

## Project structure

1. `contracts` - Smart Contracts source code.
1. `helpers` - NodeJS command line scripts helping to deploy/interact with Smart Contracts.
1. `test` - Smart contracts unit tests.

## How to setup dev environment?

1. Install docker.
1. Run `docker-compose build`.
1. Create `komodo.conf`: https://github.com/jl777/komodo#git-pullzcutilfetch-paramsshzcutilbuildsh--j8to-reset-the-blockchain-from-komodo-rm--rf-blocks-chainstate-debuglog-komodostate-dblogcreate-komodoconf.
1. Create `ETOMIC.conf` at `~/.komodo/ETOMIC`. Example can be found in this repository.
1. Run `docker-compose run --rm komodod-etomic ./fetch-params.sh`.
1. `cp .env.empty .env` - fill your .env file according to `ETOMIC.conf`.
1. Start containers `docker-compose up -d`.
1. Install project dependencies: `docker-compose exec workspace yarn`.
1. To run tests: `docker-compose exec workspace truffle test`.
1. To run helper scripts set `ETOMIC_RELAY_PK`, `INITIATOR_PK`, `RECEIVER_PK` in .env file. These variables should contain valid Ethereum private keys - these keys stay at your local machine, however it's not recommended to put keys having access to real money.

## Related links

1. Komodo platform - https://www.komodoplatform.com
1. BarterDex - https://www.komodoplatform.com/en/technology/barterdex

## Useful links for smart contracts development

1. Truffle suite - https://github.com/trufflesuite/truffle
1. Ganache-cli (EthereumJS Testrpc) - https://github.com/trufflesuite/ganache-cli
1. Zeppelin Solidity - https://github.com/OpenZeppelin/zeppelin-solidity
