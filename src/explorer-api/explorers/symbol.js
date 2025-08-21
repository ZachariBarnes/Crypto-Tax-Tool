import { coinConfig } from '../coinConfig';

const symbol_sdk_1 = require('symbol-sdk');

export class Symbol {
  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];
    try {
      const nodeUrl = coinConfig[coin].nodeEndpoint;
      const repositoryFactory = new symbol_sdk_1.RepositoryFactoryHttp(nodeUrl);
      const transactionHttp = repositoryFactory.createTransactionRepository();
      const addr = symbol_sdk_1.Address.createFromRawAddress(address);
      const maxTransactions = 10;
      const searchCriteria = {
        group: symbol_sdk_1.TransactionGroup.Confirmed,
        address: addr,
        pageNumber: 1,
        pageSize: 50,
      };
      return transactionHttp
        .search(searchCriteria)
        .toPromise()
        .then(
          (page) => {
            txs = page.data
              ? page.data.reverse().slice(0, maxTransactions)
              : [];
            txs.forEach((tx, index) => {
              tx.txid = tx.transactionInfo.hash;
              tx.realValue = parseInt(tx.mosaics[0].amount) / 1000000;
              tx.memo = tx.message.payload ? tx.message.payload : null;
              tx.income = tx.recipientAddress.address.toLowerCase()
                == address.toLowerCase();
              tx.time = tx.slot = txs.length - index;
            });

            txData.insight_status = true;
            txData.txs = txs;
            return txData;
          },
          (err) =>
            // console.error(err);
            txData,

        );
    } catch (error) {
      // console.log(error);
      return txData;
    }
  }
}
