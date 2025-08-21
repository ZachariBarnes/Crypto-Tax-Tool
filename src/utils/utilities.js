/* eslint-disable no-bitwise */
import logger from 'npmlog';
import fs from 'fs';
import mimemessage from 'mimemessage';
import { v4 as uuidv4 } from 'uuid';
import img1 from '../images/ascii-art-default.js';
import img2 from '../images/ascii-art-spin1.js';
import img3 from '../images/ascii-art-spin2.js';
import img4 from '../images/ascii-art-spin3.js';

const asciiNumOfLines = 16;

export const getUrl = (coinSymbol, urlMap, address) => {
  const ADDRESS = 'ADDRESS_PARAMETER';
  if (urlMap.has(coinSymbol)) {
    const url = urlMap.get(coinSymbol);
    logger.info('Url:', url);
    return url.replace(ADDRESS, address);
  }
  throw new Error('Invalid coin symbol');
};

export const generateFileName = (prefix) => {
  const currDate = new Date().toISOString().split('T')[0];
  const filename = `${prefix ? `${prefix}_` : ''}Transactions_${currDate}.csv`;
  return filename;
};

export const generateUUID = () => uuidv4();

// Loading spinner handler

export const startVDLLoadingSpinner = () => {
  const P = [img1, img2, img3, img4];
  let x = 0;
  return setInterval(() => {
    process.stdout.write(`\r${P[x++]}`);
    process.stdout.moveCursor(0, -asciiNumOfLines);
    x &= 3;
  }, 150);
};

export const startLoadingSpinner = () => {
  const P = ['◢ ', '◣ ', '◤ ', '◥ '];
  let x = 0;
  return setInterval(() => {
    process.stdout.write(`\r${P[x++]}`);
    x &= 3;
  }, 200);
};

export const endLoadingSpinner = (id, vdlSpinner = true) => {
  clearInterval(id);
  if (vdlSpinner) {
    for (let i = 0; i < asciiNumOfLines; i++) {
      process.stdout.clearLine();
      process.stdout.write('\n');
    }
    process.stdout.moveCursor(0, -asciiNumOfLines);
  }
};

export const createMIMEMessageFromFile = (recipient, subject, bodyText, filename, sourceEmail) => {
  const mailContent = mimemessage.factory({ contentType: 'multipart/mixed', body: [] });
  mailContent.header('From', sourceEmail);
  mailContent.header('To', recipient);
  mailContent.header('Subject', subject);
  const alternateEntity = mimemessage.factory({
    contentType: 'multipart/alternate',
    body: [],
  });
  const htmlEntity = mimemessage.factory({
    contentType: 'text/html;charset=utf-8',
    body: `${'   <html>  '
           + '   <head></head>  '
           + '   <body>  '
           + '   <h1>Your transaction report is ready</h1>  '}${
      bodyText.split('\n').map((line) => `<p>${line}</p>`).join('')
    }   <p> Please see the attached file for a list of Transactions.</p>  `
           + '   </body>  '
           + '  </html>  ',
  });
  const plainEntity = mimemessage.factory({ body: bodyText });
  alternateEntity.body.push(htmlEntity);
  alternateEntity.body.push(plainEntity);
  mailContent.body.push(alternateEntity);

  const data = fs.readFileSync(`./output/${filename}`);
  const attachmentEntity = mimemessage.factory({
    contentType: 'text/plain',
    contentTransferEncoding: 'base64',
    body: data.toString('base64').replace(/([^\0]{76})/g, '$1\n'),
  });
  attachmentEntity.header('Content-Disposition', `attachment ;filename="${filename}"`);
  mailContent.body.push(attachmentEntity);
  return mailContent.toString();
};

export const createMIMEMessageFromURI = (recipient, subject, bodyText, filename, uri, sourceEmail) => {
  const mailContent = mimemessage.factory({ contentType: 'multipart/mixed', body: [] });
  mailContent.header('From', sourceEmail);
  mailContent.header('To', recipient);
  mailContent.header('Subject', subject);
  const alternateEntity = mimemessage.factory({
    contentType: 'multipart/alternate',
    body: [],
  });
  const htmlEntity = mimemessage.factory({
    contentType: 'text/html;charset=utf-8',
    body: '   <html>  '
           + '   <head></head>  '
           + '   <body>  '
           + '   <h1>Your transaction report is ready</h1>  '
           + '   <p>Please follow the file link for a list of Transactions.</p>  '
           + `   <a href=${uri}>${filename}</a>  `
           + '   </body>  '
           + '  </html>  ',
  });
  const plainEntity = mimemessage.factory({ body: bodyText });
  alternateEntity.body.push(htmlEntity);
  alternateEntity.body.push(plainEntity);
  mailContent.body.push(alternateEntity);

  return mailContent.toString();
};

// Error Handling

export const getGenericError = (error) => ({
  message: 'Something went wrong',
  error: true,
  errorMessage: error.message,
  stack: error.stack,
});

export const getErrorWithMessage = (message, error) => ({
  message,
  error: true,
  errorMessage: error.message,
  stack: error.stack,
});

export const createErrorFromMessage = (message) => {
  const error = {
    message,
    error: true,
  };
  return error;
};
