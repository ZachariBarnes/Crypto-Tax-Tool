import axios from 'axios';

import { coinConfig } from '../coinConfig';

const Web3 = require('web3');
const ethers = require('ethers');

export class Web3Explorer {
  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];

    const url_addr = coinConfig[coin].insight_addr.replace(
      '{SENDER_ADDRESS}',
      address,
    );
    return axios
      .get(url_addr)
      .then((response) => {
        const util = ethers.utils;
        txData.insight_status = true;
        if (response.data.result.length) {
          // console.log(response.data.result.slice(0, 10));
          txs = response.data.result.slice(0, 10);
          txs.forEach((tx) => {
            tx.txid = tx.hash;
            const val = util.bigNumberify(tx.value);
            tx.value = util.formatUnits(val, coinConfig[coin].decimals);
            const realValue = util.formatUnits(val, coinConfig[coin].decimals);
            tx.realValue = realValue;
            tx.income = tx.to.toLowerCase() == address.toLowerCase();
            tx.time = tx.timeStamp;
          });
          txData.txs = txs;
        }
        return txData;
      })
      .catch((err) =>
        // console.log(err);
        txData);
  }
}
