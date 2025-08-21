/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import logger from 'npmlog';

const MODES = {
  RECIEVE: Symbol('recieve'),
  SEND: Symbol('send'),
};

export class CosmosExplorerConfig {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.transactionUrl = `${this.baseUrl}/tx/v1beta1/txs`;
    this.walletAddress = 'XXXXXXXXXXXXXXX';
    this.transactionsPerPage = 25;
    this.denom = 1000000;
    this.requestTotal = Infinity;
    this.txTotal = undefined;
    this.txSoFar = 0;
    this.mode = MODES.RECIEVE;
    this.offset = 0;
    this.paginationLimit = this.transactionsPerPage;
    this.paginationOffset = this.offset;
    this.modeSwitched = false;
    this.requestsSoFar = 0;
  }

  updateSearchParams(mode, newOffset = this.offset) {
    this.pagination = `limit=${this.transactionsPerPage}&offset=${newOffset}`;
    let searchParams;
    switch (mode) {
      case MODES.RECIEVE: {
        this.recieveParams['pagination.offset'] = newOffset;
        searchParams = this.recieveParams;
        break;
      }
      case MODES.SEND: {
        this.sendParams['pagination.offset'] = newOffset;
        searchParams = this.sendParams;
        break;
      }
      default: {
        throw new Error('Invalid mode');
      }
    }
    this.searchParams = searchParams;
    return this.searchParams;
  }

  switchModes() {
    this.mode = MODES.SEND;
    logger.warn('Switching modes to gather SEND transactions for Cosmos Explorer. Coin:', { symbol: this.symbol, txSoFar: this.txSoFar });
    this.offset = 0;
    this.modeSwitched = true;
    this.requestTotal = Infinity;
    this.txTotal = undefined;
    this.requestsSoFar = 0;
    this.offset = 0;
    this.sendParams['pagination.offset'] = this.offset;
    this.sarchParams = this.sendParams;
  }

  updateWallet(walletAddress, symbol) {
    this.walletAddress = walletAddress;
    this.recieveParams = {
      events: `transfer.recipient='${this.walletAddress}'`,
      order_by: 'ORDER_BY_DESC',
      'pagination.offset': 0,
      'pagination.limit': this.transactionsPerPage,
    };
    this.sendParams = {
      events: `message.sender='${this.walletAddress}'`,
      message: 'action=\'/cosmos.bank.v1beta1.Msg/Send\'',
      order_by: 'ORDER_BY_DESC',
      'pagination.offset': 0,
      'pagination.limit': this.transactionsPerPage,
    };
    this.mode = MODES.RECIEVE;
    this.txTotal = undefined;
    this.symbol = symbol;
    this.verifyAddressUrl = `${this.baseUrl}/bank/v1beta1/balances/${this.walletAddress}`;
    this.searchParams = this.recieveParams;
    this.modeSwitched = false;
  }

  // eslint-disable-next-line no-unused-vars
  paginate(response, allItems, currentItems) {
    const previousSearchParams = response.request.options.searchParams;
    if (!this.shouldContinue(response, allItems, currentItems, this.cutoffdate)) {
      return false;
    }
    return {
      searchParams: this.getNextParams(previousSearchParams),
    };
  }

  // eslint-disable-next-line no-unused-vars
  getNextParams(previousParams) {
    if (this.txTotal === 0) {
      this.offset = 0;
    } else if (this.offset < this.txTotal) {
      this.offset += this.transactionsPerPage;
      logger.info('Next Offset', { offset: this.offset, txCount: this.txSoFar, expectedTxTotal: this.txTotal });
      if (this.txTotal && this.offset >= this.txTotal) {
        if (!this.shouldContinue(null, null, null, null))
          return false;
        this.offset = this.txTotal;
      }
    }
    return this.updateSearchParams(this.mode, this.offset);
  }

  transformResponse(response) {
    this.requestsSoFar += 1;
    const { body: res } = response;
    const body = JSON.parse(res);
    delete body.txs;
    const { tx_responses: txResponses, pagination } = body;
    const requestLimit = Math.ceil(pagination.total / this.transactionsPerPage, 10);
    if (!this.txTotal || this.requestTotal !== requestLimit)/* (this.requestTotal !== requestLimit || this.modeSwitched) */ {
      this.requestTotal = requestLimit;
      this.txTotal = Number.parseInt(pagination.total, 10);
    }
    const transactions = [];
    txResponses.forEach((tx) => transactions.push(...this.transformTransactionV2(tx)));
    // this.requestsSoFar += 1;
    if (this.requestsSoFar >= this.requestTotal && this.mode === MODES.RECIEVE) {
      // logger.warn('Attempting to Switch to SEND mode in transformResponse.', {
      //   txSoFar: this.txSoFar,
      //   txTotal: this.txTotal,
      //   requestsSoFar: this.requestsSoFar,
      //   requestTotal: this.requestTotal,
      //   requestLimitCalc: requestLimit,
      // });
      this.switchModes();
    }
    // logger.info(`Returning ${transactions.length} transactions from Cosmos Explorer.
    // Parent Request Limit: ${this.requestTotal}.
    // Request Number: ${this.requestsSoFar}.
    // ReqeustLimit: ${requestLimit}`);
    return { transactions, requestLimit: this.requestTotal };
  }

  shouldContinue(item, allItems, currentItems, cutoffdate) {
    let getNextPage = true;
    if (cutoffdate) {
      const date = new Date(item.Date);
      getNextPage = date > cutoffdate;
    }
    if (this.requestsSoFar > this.requestTotal) {
      getNextPage = false;
    }

    if (!this.shouldContinue && this.mode === MODES.RECIEVE) {
      this.switchModes();
      return true;
    }
    // logger.info('Should Continue', { getNextPage, requestsSoFar: this.requestsSoFar, requestTotal: this.requestTotal });
    return getNextPage;
  }

  extractAttributes(attributes, obj) {
    for (const property of attributes)
    {
      // console.log(property);
      obj[property.key] = property.value;
      // console.log(obj[property.key]);
    }
  }

  transformTransactionV2(transaction) {
    const transactionRows = [];
    this.txSoFar += 1;
    delete transaction.data;
    delete transaction.raw_log;
    // delete transaction.logs;
    const { logs } = transaction;
    for (const log of logs) {
      const { events } = log;
      const tx = {};
      const msg = {};
      const msgEvent = events.find((event) => event.type === 'message');
      if (msgEvent) {
        this.extractAttributes(msgEvent.attributes, msg);
      }
      else {
        logger.error('No message event found in log for transaction', { transaction });
        continue;
      }
      const eventList = events.filter((event) => event.attributes.filter((attribute) => attribute.value === this.walletAddress).length);

      for (const event of eventList) {
        const { type, attributes } = event;
        if (type === 'transfer') {
          this.extractAttributes(attributes, tx);
        }
        else {
          continue;
        }
      }

      if (tx.amount) {
        const { recipient, sender, amount } = tx;
        const amt = amount ? parseInt(amount.replace('uvdl', ''), 10) / this.denom : 0;
        const from = sender === this.walletAddress;
        const to = recipient === this.walletAddress;
        const sentAmount = from ? amt : 0;
        const receivedAmount = to ? amt : 0;

        // Make labels human readable
        let label = msg.action.replace('/cosmos.bank.v1beta1.', '')
          .replace('/cosmos.staking.v1beta1.', '')
          .replace('/cosmos.distribution.v1beta1.', '');

        label = label === 'MsgSend' ? from ? 'Sent' : 'Received' : label;

        // eslint-disable-next-line no-unused-vars, max-len
        const columns = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash'];
        transactionRows.push({
          Date: new Date(transaction.timestamp).toISOString(),
          SentAmt: sentAmount, // sent Amt
          SentSymbol: from ? this.symbol : '', // sent Currency
          ReceivedAmt: receivedAmount, // received Amt
          ReceivedSymbol: to ? this.symbol : '', // received Currency
          FeeAmt: from ? transaction.gas_used / this.denom : 0, // transaction.fees, (applicable for incoming tx???)
          FeeSymbol: this.symbol, // symbol, //fee Currency
          NetWorthAmt: '', // net Worth Amt (optional)
          NetWorthSymbol: '', // net Worth Currency (optional)
          Label: label, // label (optional)
          Description: '', // description (optional)
          TxHash: transaction.txhash, // txHash
        });
      }
    }
    const rows = transactionRows;
    return rows;
  }

  cleanUp() {
    this.walletAddress = null;
    this.offset = 0;
    this.paginatation = `limit=${this.transactionsPerPage}&offset=${this.offset}`;
    this.recieveParams = {
      events: `transfer.recipient='${this.walletAddress}'`,
      order_by: 'ORDER_BY_DESC',
      'pagination.offset': 0,
      'pagination.limit': this.transactionsPerPage,
    };
    this.sendParams = {
      events: `message.sender='${this.walletAddress}'`,
      message: 'action=\'/cosmos.bank.v1beta1.Msg/Send\'',
      order_by: 'ORDER_BY_DESC',
      'pagination.offset': 0,
      'pagination.limit': this.transactionsPerPage,
    };
    this.mode = MODES.RECIEVE;
    this.txTotal = 0;
    this.requestsSoFar = 0;
    this.requestTotal = Infinity;
    this.verifyAddressUrl = `${this.baseUrl}/bank/v1beta1/balances/${this.walletAddress}`;
    this.searchParams = this.recieveParams;
    this.modeSwitched = false;
    this.txSoFar = 0;
  }
}

export default CosmosExplorerConfig;
