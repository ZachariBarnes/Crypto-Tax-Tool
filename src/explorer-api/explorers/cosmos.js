import axios from 'axios';
import { coinConfig } from '../coinConfig';
import { Utils } from '@/assets/js/utils';

const utils = new Utils();

export class Cosmos {
  async getTransactions(address, coin) {
    const txData = {
      insight_status: false,
      txs: [],
    };
    let txs = [];

    try {
      const txSentURL = `${coinConfig[coin].lcdUrl
      }/cosmos/tx/v1beta1/txs?events=message.sender='{SENDER_ADDRESS}'&message.action='/cosmos.bank.v1beta1.Msg/Send'`;
      const txReceiveURL = `${coinConfig[coin].lcdUrl
      }/cosmos/tx/v1beta1/txs?events=transfer.recipient='{SENDER_ADDRESS}'`;
      // &message.action='/cosmos.bank.v1beta1.Msg/Send'&message.action='/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'

      const sent_url_addr = txSentURL.replace('{SENDER_ADDRESS}', address);
      const receive_url_addr = txReceiveURL.replace(
        '{SENDER_ADDRESS}',
        address,
      );

      const sentTXs = await axios.get(sent_url_addr);
      // console.log(sentTXs);
      const receivedTXs = await axios.get(receive_url_addr);

      // check for duplicate records and consolidate
      // these really would only be when tokens were sent to self
      // and should be easily detected by the same block height on
      // both sentTXs and receivedTXs
      let consolidatedTXs = [];
      if (
        sentTXs.data.tx_responses.length
        && receivedTXs.data.tx_responses.length
      ) {
        const sTXs = sentTXs.data.tx_responses;
        const rTXs = receivedTXs.data.tx_responses;

        sTXs.forEach((stx) => {
          let match = null;
          rTXs.forEach((rtx, i) => {
            if (rtx !== undefined)
              if (stx.height == rtx.height) {
                // console.log(rtx.txhash);
                match = i;
              }
          });
          if (match !== null) delete rTXs[match];
        });

        const cleaned = rTXs.filter((tx) => tx !== undefined);
        consolidatedTXs = [...sTXs, ...cleaned];
        consolidatedTXs.sort((a, b) => (Number(a.height) > Number(b.height) ? 1 : -1));
      } else if (sentTXs.data.tx_responses.length)
        consolidatedTXs = sentTXs.data.tx_responses;
      else if (receivedTXs.data.tx_responses.length)
        consolidatedTXs = receivedTXs.data.tx_responses;

      // console.log("sentTXs", sentTXs.data);
      // console.log("receivedTXs", receivedTXs.data);
      // console.log("consolidatedTXs", consolidatedTXs);
      if (consolidatedTXs.length) {
        txs = consolidatedTXs.reverse().slice(0, 10);
        txs.forEach((tx) => {
          // console.log(tx);

          tx.name = coin;
          // console.log("name", tx.name);
          tx.txid = tx.txhash;
          // console.log("txid", tx.txhash);
          const fee = Number(
            tx.tx.auth_info.fee.length
              ? utils.denomToTokens(tx.tx.auth_info.fee[0].amount)
              : 0,
          );
          // console.log("fee", fee);
          tx.time = new Date(tx.timestamp).valueOf() / 1000;
          // console.log("time", tx.time);
          tx.slot = Number(tx.height);
          // console.log("slot", tx.slot);
          tx.memo = tx.tx.body.memo ? tx.tx.body.memo : '';
          // console.log("memo", tx.tx.body.memo);
          tx.messageType = '';

          // console.log(tx.tx.body.messages);
          const message = tx.tx.body.messages[0];
          switch (message['@type']) {
            case '/cosmos.bank.v1beta1.MsgSend':
              // console.log("send", message);
              tx.realValue = tx.value = utils.denomToTokens(
                message.amount[0].amount,
              );
              if (
                message.from_address.toLowerCase()
                == message.to_address.toLowerCase()
              ) {
                tx.messageType = 'Self Send';
                tx.income = true;
              } else if (
                message.to_address.toLowerCase() == address.toLowerCase()
              ) {
                tx.messageType = 'Receive';
                tx.income = true;
              } else {
                tx.messageType = 'Send';
                tx.income = false;
              }

              break;

            case '/cosmos.staking.v1beta1.MsgBeginRedelegate':
              // console.log("redelegate", message);
              tx.messageType = 'Redelegate';
              tx.realValue = tx.value = utils.denomToTokens(
                message.amount.amount,
              );
              tx.income = false;
              break;

            case '/cosmos.staking.v1beta1.MsgDelegate':
              // console.log("delegate", message);
              tx.messageType = 'Delegate';
              tx.realValue = tx.value = utils.denomToTokens(
                message.amount.amount,
              );
              tx.income = false;
              break;

            case '/cosmos.staking.v1beta1.MsgUndelegate':
              // console.log("undelegate", message);
              tx.messageType = 'Undelegate';
              tx.realValue = tx.value = utils.denomToTokens(
                message.amount.amount,
              );
              tx.income = true;
              break;

            case '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward':
              // console.log("withdraw", tx);
              tx.logs[0].events.forEach((e) => {
                if (e.type == 'coin_received') {
                  e.attributes.forEach((a) => {
                    if (a.key == 'amount') {
                      tx.value = tx.realValue = utils.denomToTokens(
                        a.value.slice(
                          0,
                          a.value.length - coinConfig[coin].denom.length,
                        ),
                      );
                    }
                  });
                }
              });
              tx.messageType = 'Rewards';
              tx.income = true;
              break;
            default:
              console.log('default');
          }
        });
        txData.txs = txs;
      }
    } catch (err) {
      console.log(err);
      // console.log(err.response);
      if (err.response.status == 400) txData.insight_status = true;
      return txData;
    }
    txData.insight_status = true;
    return txData;
  }
}
