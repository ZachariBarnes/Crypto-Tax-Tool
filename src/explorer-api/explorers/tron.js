const TronWeb = require('tronweb');

export class Tron {
  async getBalance(address, coin) {
    const tronWeb = new TronWeb(fullNode, solidityNode);

    const balanceData = {
      insight_status: false,
      balance: 0,
    };
    return tronWeb.trx
      .getBalance(address)
      .then((userBalance) => {
        console.log(`User's balance is: ${userBalance}`);
        balanceData.insight_status = true;
        balanceData.balance = userBalance;
        return balanceData;
      })
      .catch((error) => {
        console.error(error);
        return balanceData;
      });
  }

  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    return txData;
  }

  getUnspent(address, coin) {
    // console.log("this");
  }

  sendTransaction(hex, coin) {
    // console.log("this");
  }
}
