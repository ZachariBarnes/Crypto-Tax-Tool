// import ExplorerConfig from '../types/config.js';

import logger from 'npmlog';

export class BlockbookExplorerConfig {
  constructor(baseUrl) {
    // super();
    this.baseUrl = baseUrl;
    this.transactionUrl = `${baseUrl}`;
    this.transactionsPerPage = 1000;
    this.pageNum = 1;
    this.smallestDenom = 100000000; // 8 Zeros BTC/Satoshi
  }

  updateWallet(walletAddress, symbol) {
    this.walletAddress = walletAddress;
    this.symbol = symbol;
    this.verifyAddressUrl = `${this.baseUrl}/address/${this.walletAddress}`;
    this.transactionUrl = `${this.baseUrl}/address/${this.walletAddress}`;
    this.searchParams = {
      details: 'txs',
      page: this.pageNum,
      pageSize: this.transactionsPerPage,
    };
  }

  paginate(response, allItems, currentItems) {
    const previousSearchParams = response.request.options.searchParams;
    // logger.info(`url: ${previousSearchParams}`, pageNum);
    // logger.info(`Response:`, currentItems);

    if (currentItems.length < this.transactionsPerPage) {
      return false;
    }

    return {
      searchParams:
                this.getNextParams(previousSearchParams),
    };
  }

  getNextParams(previousParams) {
    const pageNum = this.pageNum++;
    return { ...previousParams, page: pageNum };
  }

  transformResponse(response) {
    logger.info('Request URL:', response.request.requestUrl);
    logger.info('Request options:', response.request.options);
    const { body } = response;
    const { transactions: txs, totalPages } = JSON.parse(body);
    const requestLimit = totalPages;
    const transactions = [];
    txs.forEach((tx) => transactions.push(...this.transformTransaction(tx)));
    // console.log(transactions);
    return { transactions, requestLimit };
  }

  shouldContinue(item, allItems, currentItems, cutoffdate) {
    let getNextPage = true;
    if (cutoffdate) {
      const date = new Date(item.Date);
      getNextPage = date > cutoffdate;
    }
    return getNextPage;
  }

  transformTransaction(transaction) {
    const inputRows = [];
    // eslint-disable-next-line no-unused-vars, max-len
    const columns = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash'];
    transaction.vin.forEach((txIn) => {
      const { addresses } = txIn;
      if (addresses.indexOf(this.walletAddress) >= 0) {
        inputRows.push({
          Date: new Date(transaction.blockTime * 1000).toISOString(),
          SentAmt: txIn.value / this.smallestDenom, // sent Amt
          SentSymbol: this.symbol, // sent Currency
          ReceivedAmt: 0, // received Amt
          ReceivedSymbol: '', // received Currency
          FeeAmt: transaction.fees / this.smallestDenom, // transaction.fees, (applicable for incoming tx???)
          FeeSymbol: this.symbol, // symbol, //fee Currency
          NetWorthAmt: '', // net Worth Amt (optional)
          NetWorthSymbol: '', // net Worth Currency (optional)
          Label: '', // label (optional)
          Description: '', // description (optional)
          TxHash: txIn.txid, // txHash
        });
      }
    });

    const outgoingRows = [];
    transaction.vout.forEach((txOut) => {
      const { addresses } = txOut;
      if (addresses.indexOf(this.walletAddress) > -1) {
        outgoingRows.push({
          Date: new Date(transaction.blockTime * 1000).toISOString(),
          SentAmt: 0, // sent Amt
          SentSymbol: '', // sent Currency
          ReceivedAmt: txOut.value / this.smallestDenom, // received Amt
          ReceivedSymbol: this.symbol, // received Currency
          FeeAmt: 0, // transaction.fees, (applicable for incoming tx???)
          FeeSymbol: '', // symbol, //fee Currency
          NetWorthAmt: '', // net Worth Amt (optional)
          NetWorthSymbol: '', // net Worth Currency (optional)
          Label: '', // label (optional) (Should we use a different tag here?)
          Description: '', // description (optional)
          TxHash: transaction.txid, // txHash
        });
      }
    });
    const rows = [...inputRows, ...outgoingRows];
    return rows;
  }

  cleanUp() {
    this.walletAddress = null;
    this.pageNum = 1;
    this.verifyAddressUrl = `${this.baseUrl}/address/${this.walletAddress}`;
    this.transactionUrl = `${this.baseUrl}/address/${this.walletAddress}`;
    this.searchParams = {
      details: 'txs',
      page: this.pageNum,
      pageSize: this.transactionsPerPage,
    };
  }
}

export default BlockbookExplorerConfig;
