import { coinConfig } from '../coinConfig';

const ethers = require('ethers');

export class Etherscan {
  async getTransactions(address, coin) {
    const util = ethers.utils;
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];
    if (coinConfig[coin].erc20) {
      try {
        const abi = [
          'event Transfer(address indexed from, address indexed to, uint tokens)',
        ];

        const provider = ethers.getDefaultProvider();
        const contract = new ethers.Contract(
          coinConfig[coin].contractAddress,
          abi,
          provider,
        );

        const filterIn = contract.filters.Transfer(null, address);
        filterIn.fromBlock = 9600000;
        filterIn.toBlock = 'latest';
        const filterOut = contract.filters.Transfer(address, null);
        filterOut.fromBlock = 9600000;
        filterOut.toBlock = 'latest';

        provider.getLogs(filterIn).then((logs) => {
          logs.forEach((log) => {
            const data = contract.interface.parseLog(log);
            provider.getBlock(log.blockNumber).then((result) => {
              if (data.values.from == address) {
                txs.push({
                  txid: log.transactionHash,
                  value: 0,
                  realValue: 0,
                  income: true,
                  time: result.timestamp - 1,
                  timestamp: result.timestamp - 1,
                });
              } else {
                txs.push({
                  txid: log.transactionHash,
                  value: util.formatUnits(
                    data.values.tokens,
                    coinConfig[coin].decimals,
                  ),
                  realValue: util.formatUnits(
                    data.values.tokens,
                    coinConfig[coin].decimals,
                  ),
                  income: true,
                  time: result.timestamp,
                  timestamp: result.timestamp,
                });
              }
            });
          });
        });

        provider.getLogs(filterOut).then((logs) => {
          logs.forEach((log) => {
            const data = contract.interface.parseLog(log);
            provider.getBlock(log.blockNumber).then((result) => {
              txs.push({
                txid: log.transactionHash,
                value: util.formatUnits(
                  data.values.tokens,
                  coinConfig[coin].decimals,
                ),
                realValue: util.formatUnits(
                  data.values.tokens,
                  coinConfig[coin].decimals,
                ),
                income: false,
                time: result.timestamp,
                timestamp: result.timestamp,
              });
            });
          });
        });

        txs.sort((a, b) => (a.time < b.time ? 1 : -1));
        txData.insight_status = true;
        txData.txs = txs;
        return txData;
      } catch (error) {
        // console.log(error);
        return txData;
      }
    } else {
      const etherscanProvider = new ethers.providers.EtherscanProvider();
      return etherscanProvider
        .getHistory(address)
        .then((history) => {
          txs = history ? history.reverse().slice(0, 10) : [];
          txs.forEach((tx) => {
            tx.txid = tx.hash;
            const val = util.bigNumberify(tx.value._hex);
            tx.value = util.formatUnits(val, coinConfig[coin].decimals);
            const realValue = util.formatUnits(val, coinConfig[coin].decimals);
            tx.realValue = realValue;
            tx.income = tx.to.toLowerCase() == address.toLowerCase();
            tx.time = tx.timestamp;
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
}
