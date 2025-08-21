import axios from 'axios';
import { coinConfig } from '../coinConfig';

export class Insight {
  async getTransactions(address, coin) {
    let url_txs = coinConfig[coin].insight_tx.replace(
      '{SENDER_ADDRESS}',
      address,
    );
    if (coinConfig[coin].explorer == 'insight') {
      const page = 0;
      url_txs = `${url_txs}&pageNum=${page}`;
    }

    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];

    return axios
      .get(url_txs)
      .then((data) => {
        txs = data.data.txs ? data.data.txs : [];
        // if tx is from a Z address then add 'z' to the 'addr'
        // so we can differentiate
        if (coinConfig[coin].z) {
          for (let i = 0; i < txs.length; i++) {
            if (txs[i].vin.length == 0) {
              txs[i].vin.push({ addr: 'z' });
            }
          }
        }
        txs.forEach((tx) => {
          let value = 0;
          let sentOut = 0;
          let intoMine = 0;
          let intoOther = 0;
          let income = false;

          tx.vin.forEach((vin) => {
            // inputs from our wallet
            if (vin.addr == address) {
              sentOut += Number(vin.value);
            }
          });

          tx.vout.forEach((vout) => {
            if (vout.scriptPubKey.addresses[0] == address) {
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

          tx.realValue = value;
          tx.income = income;
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
