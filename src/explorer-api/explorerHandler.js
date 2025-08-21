/* eslint-disable */
import { Blockbook } from './explorers/blockbook';
import { Etherscan } from './explorers/etherscan';
import { Web3Explorer } from './explorers/web3';
import { Solana } from './explorers/solana';
import { Nem } from './explorers/nem';
import { Symbol } from './explorers/symbol';
import { Insight } from './explorers/insight';
import { Tron } from './explorers/tron';
import { Cosmos } from './explorers/cosmos';
import { coinConfig } from './coinConfig';

export class ExplorerHandler {
  constructor(address, coin) {
    let explorer = null;
    switch (coinConfig[coin].explorer) {
      case 'blockbook':
        explorer = new Blockbook();
        break;

      case 'etherscan':
        explorer = new Etherscan();
        break;

      case 'web3':
        explorer = new Web3Explorer();
        break;

      case 'solana':
        explorer = new Solana();
        break;

      case 'nem':
        explorer = new Nem();
        break;

      case 'symbol':
        explorer = new Symbol();
        break;

      case 'tron':
        explorer = new Tron();
        break;

      case 'cosmos':
        explorer = new Cosmos();
        break;

      case 'sochain':
      case 'bitcoin.com':
      case 'insight':
        explorer = new Insight();
        break;
    }
    this.explorer = explorer;
    this.address = address;
    this.coin = coin;
  }

  getTransactions() {
    const emptyData = {
      insight_status: false,
      txs: [],
    };

    if (this.explorer) {
      return this.explorer
        .getTransactions(this.address, this.coin)
        .then((txData) => txData)
        .catch((error) =>
          // console.log(error);
          emptyData);
    }
    //   console.log("TX Explorer Handler Error");
    return emptyData;
  }
}
