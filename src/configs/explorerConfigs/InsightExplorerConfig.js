// import ExplorerConfig from '../types/config.js';

export class InsightExplorerConfig {
  constructor(baseUrl) {
    // super();
    this.baseUrl = baseUrl;
    this.transactionUrl = `${baseUrl}/txs/`;
    this.transactionsPerPage = 10;
    this.pageNum = 0;
  }

  updateWallet(walletAddress, symbol) {
    this.walletAddress = walletAddress;
    this.symbol = symbol;
    this.verifyAddressUrl = `${this.baseUrl}/addr/${this.walletAddress}/?noTxList=1`;
    this.searchParams = {
      address: this.walletAddress,
      pageNum: 0,
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
    return { ...previousParams, pageNum };
  }

  transformResponse(response) {
    const { body } = response;
    const { txs, pagesTotal } = JSON.parse(body);
    const requestLimit = pagesTotal;
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
      if (txIn.addr === this.walletAddress) {
        inputRows.push({
          Date: new Date(transaction.time * 1000).toISOString(),
          SentAmt: txIn.value, // sent Amt
          SentSymbol: this.symbol, // sent Currency
          ReceivedAmt: 0, // received Amt
          ReceivedSymbol: '', // received Currency
          FeeAmt: transaction.fees, // transaction.fees, (applicable for incoming tx???)
          FeeSymbol: this.symbol, // symbol, //fee Currency
          NetWorthAmt: '', // net Worth Amt (optional)
          NetWorthSymbol: '', // net Worth Currency (optional)
          Label: '', // label (optional)
          Description: '', // description (optional)
          TxHash: transaction.txid, // txHash
        });
      }
    });

    const outgoingRows = [];
    transaction.vout.forEach((txOut) => {
      const { scriptPubKey } = txOut;
      const { addresses } = scriptPubKey;
      if (addresses.indexOf(this.walletAddress) > -1) {
        outgoingRows.push({
          Date: new Date(transaction.time * 1000).toISOString(),
          SentAmt: 0, // sent Amt
          SentSymbol: '', // sent Currency
          ReceivedAmt: txOut.value, // received Amt
          ReceivedSymbol: this.symbol, // received Currency
          FeeAmt: 0, // transaction.fees, (applicable for incoming tx???)
          FeeSymbol: '', // symbol, //fee Currency
          NetWorthAmt: '', // net Worth Amt (optional)
          NetWorthSymbol: '', // net Worth Currency (optional)
          Label: 'reward', // label (optional) (Should we use a different tag here?)
          Description: transaction.vout.length > 2 ? 'V-tip or Mining reward' : '', // description (optional)
          TxHash: transaction.txid, // txHash
        });
      }
    });
    const rows = [...inputRows, ...outgoingRows];
    return rows;
  }

  cleanUp() {
    this.walletAddress = null;
    this.pageNum = 0;
    this.verifyAddressUrl = `${this.baseUrl}/addr/${this.walletAddress}/?noTxList=1`;
    this.searchParams = {
      address: this.walletAddress,
      pageNum: 0,
    };
  }
}

export default InsightExplorerConfig;
