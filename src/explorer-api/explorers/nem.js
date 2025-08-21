const nem = require('nem-sdk').default;

export class Nem {
  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];
    try {
      const endpoint = nem.model.objects.create('endpoint')(
        `https://magic.vidulum.app/${
          nem.model.nodes.defaultMainnet.split('//')[1]}`,
        nem.model.nodes.defaultPort,
      );
      return nem.com.requests.account.transactions
        .all(endpoint, address)
        .then((results) => {
          // txs = history ? history.reverse().slice(0, 20) : [];
          txs = results ? results.data.reverse().slice(0, 10) : [];
          txs.forEach((tx) => {
            tx.txid = tx.meta.hash.data;
            if (tx.transaction.mosaics) {
              tx.realValue = tx.transaction.mosaics[0].quantity / 1000000;
            } else {
              tx.realValue = tx.transaction.amount / 1000000;
            }
            tx.memo = tx.transaction.message
              ? nem.utils.format.hexMessage(tx.transaction.message)
              : null;
            tx.income = tx.transaction.recipient.toLowerCase() == address.toLowerCase();
            // NEM has set a static 'start date' for their timestamps
            const NEM_EPOCH = Date.UTC(2015, 2, 29, 0, 6, 25, 0);
            tx.time = Math.floor(
              (NEM_EPOCH + Math.floor(tx.transaction.timeStamp * 1000)) / 1000,
            );
          });
          txData.insight_status = true;
          txData.txs = txs;
          return txData;
        })
        .catch((err) =>
          // console.log(err);
          txData);
    } catch (error) {
      // console.log(error);
    }
  }
}
