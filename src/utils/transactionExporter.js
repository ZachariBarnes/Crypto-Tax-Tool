/* eslint-disable no-restricted-syntax */
import fs from 'fs';
import logger from 'npmlog';
import dotenv from 'dotenv';

dotenv.config();
const env = process.env.NODE_ENV || 'development';
export const SaveKoinlyCsv = async (transactions, filename) => {
  const rows = transactions.map((t) => [
    t.Date,
    t.SentAmt, // sent Amt
    t.SentSymbol, // sent Currency
    t.ReceivedAmt, // received Amt
    t.ReceivedSymbol, // received Currency
    t.FeeAmt,
    t.FeeSymbol, // fee Currency
    t.NetWorthAmt, // net Worth Amt (optional)
    t.NetWorthSymbol, // net Worth Currency (optional)
    t.Label, // label (optional)
    t.Description, // description (optional)
    t.TxHash, // txHash
  ].join(','));
  // eslint-disable-next-line no-unused-vars, max-len

  const csv = `\n${rows.join('\n')}`;
  if (env === 'local') {
    fs.writeFileSync(`./output/${filename}`, csv, 'utf8', (err) => {
      if (err) {
        logger.error('Some error occured - file either not saved or corrupted file saved.');
        return null;
      }
      logger.info(`${filename} saved successfully!`);
      return null;
    });
  }
  else {
    return csv;
  }
  return csv;
};

// // Get combine multiple csv files into one
// export const getKoinlyCsvFromOtherCSVs = (files, symbol) => {
//   const errors = [];
//   const currDate = new Date().toISOString().split('T')[0];
//   const filename = `${symbol ? `${symbol}_` : ''}Transactions_${currDate}.csv`;
//   for (const file of files) {
//     const rows = [];
//     const csv = fs.readFileSync(`./output/${file}`, 'utf8');
//     const lines = csv.split('\n');
//     lines.forEach((line) => {
//       if (line) {
//         rows.push(line);
//       }
//     });
//     const data = `${rows.join('\n')}`;
//     fs.appendFile(`./output/${filename}`, data, 'utf8', (err) => {
//       if (err) {
//         logger.error('Some error occured - file either not saved or corrupted file saved.');
//         errors.push(err);
//       }
//       logger.info(`${filename} saved successfully!`);
//     });
//   }
//   return filename;
// };

export default SaveKoinlyCsv;
