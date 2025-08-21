import axios from 'axios';
import { coinConfig } from '../coinConfig';

export class Blockbook {
  async getTransactions(address, coin) {
    const url_txs = coinConfig[coin].insight_tx.replace(
      '{SENDER_ADDRESS}',
      address,
    );
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];
    return axios
      .get(url_txs)
      .then((data) => {
        txs = data.data.transactions ? data.data.transactions : [];
        // if tx is from a Z address then add 'z' to the 'addr'
        // so we can differentiate
        // if (coinConfig[coin].z) {
        //   for (var i = 0; i < txs.length; i++) {
        //     if (!txs[i].vin.isAddress) {
        //       txs[i].vin.push({ addr: "z" });
        //     }
        //   }
        // }
        txs.forEach((tx) => {
          let value = 0;
          let sentOut = 0;
          let intoMine = 0;
          let intoOther = 0;
          let income = false;

          tx.vin.forEach((vin) => {
            // blockbook explorers have vin.addresses[0]
            if (vin.isAddress)
              if (vin.addresses[0] == address) {
                // check if vin is from private - true if not private on blockbook
                sentOut += Number(vin.value);
              }
          });

          tx.vout.forEach((vout) => {
            if (vout.addresses[0] == address) {
              intoMine += Number(vout.value);
            } else {
              intoOther += Number(vout.value);
            }
          });

          // Check if we made the transaction
          if (sentOut > 0) {
            // If we did send out then income stays false
            value = intoOther + Number(tx.fees);
          } else {
            income = true;
            value = intoMine;
          }

          value /= 100000000;

          tx.realValue = value;
          tx.income = income;
          tx.time = tx.blockTime;
        });
        txData.insight_status = true;
        txData.txs = txs;
        return txData;
      })
      .catch((error) =>
        // eslint-disable-next-line no-console
        // console.log(error);
        txData);
  }
}
