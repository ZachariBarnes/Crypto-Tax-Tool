import { coinConfig } from '../coinConfig';

const solanaWeb3 = require('@solana/web3.js');

export class Solana {
  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    const txs = [];
    if (coinConfig[coin].spl) {
      try {
        return txData;
      } catch (error) {
        // console.log(error);
        return txData;
      }
    } else {
      try {
        const con = new solanaWeb3.Connection(coinConfig[coin].apiEndpoint);
        const publicKey = new solanaWeb3.PublicKey(address);
        const maxTransactions = 10;
        return con
          .getConfirmedSignaturesForAddress2(publicKey, {
            limit: maxTransactions,
          })
          .then((accountInfo) => {
            // console.log(accountInfo);
            const sigs = accountInfo.map((sig) => sig.signature);
            // console.log(sigs);
            let counter = maxTransactions;
            const collectTXData = new Promise((resolve, reject) => {
              sigs.forEach(async (sig, index, array) => {
                await con
                  .getParsedConfirmedTransaction(sig)
                  .then((sigStatus) => {
                    // console.log(sigStatus);
                    txs.push({
                      fullTX: sigStatus.transaction,
                      txid: sig,
                      realValue:
                        sigStatus.transaction.message.instructions[0].parsed
                          .info.lamports / 1000000000,
                      slot: sigStatus.slot,
                      time: counter,
                      income:
                        sigStatus.transaction.message.instructions[0].parsed
                          .info.destination == address,
                    });
                    counter--;
                    //  getSignatureStatuses;
                    if (index === array.length - 1) {
                      resolve();
                    }
                  });
              });
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
        return txData;
      }
    }
  }
}
