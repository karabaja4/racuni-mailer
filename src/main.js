const util = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

// dayjs
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const config = require('./config').get();
const log = require('./log');
const invoice = require('./invoice.json');

// readline setup
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = util.promisify(rl.question).bind(rl);

const isNumericString = (value) => {
  if (value === null || value === undefined) return false;
  const regex = /^[0-9]+$/i;
  return regex.test(value.toString());
};

const buildItemsFromArguments = () => {
  const items = [];
  const args = process.argv.slice(2);
  if (args.length < 1) {
    log.usage();
  }
  for (let i = 0; i < args.length; i++) {
    const split = args[i].trim().split('x');
    if (split.length !== 2 || !isNumericString(split[0]) || !isNumericString(split[1])) {
      log.usage();
    }
    const days = parseInt(split[0]);
    const price = parseInt(split[1]);
    if ((days === 0) || (days > 31) || (price < 300) || (price > 1000)) {
      log.usage();
    }
    const item = {
      description: 'Software development',
      unit: 'dan (day)',
      price: price,
      quantity: days
    };
    if (args.length > 1) {
      item.description += ` (P${(i + 1)})`;
    }
    items.push(item);
  }
  return items;
};

// if before 15th, look at previous month
const getInvoiceDate = () => {
  const now = dayjs().tz('Europe/Zagreb');
  if (now.date() <= 15) {
    return now.subtract(20, 'day');
  }
  return now;
};

const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const cachedRefreshTokenPath = path.resolve(__dirname, 'tokencache.json');
const getOrUpdateCachedRefreshToken = async (code, token) => {
  try {
    let cachedData = {};
    const cacheExists = await fileExists(cachedRefreshTokenPath);
    if (cacheExists) {
      const cachedContent = await fs.promises.readFile(cachedRefreshTokenPath, 'utf8');
      cachedData = JSON.parse(cachedContent);
    }
    if (token) {
      // passed token, update cache
      cachedData[code] = token;
      await fs.promises.writeFile(cachedRefreshTokenPath, JSON.stringify(cachedData, null, 2));
    } else {
      // read cache
      return cachedData[code] || null;
    }
  } catch (err) {
    log.fatal(err);
  }
  return null;
};

const getToken = async (code) => {
  
  // try to find cached refresh token and use that if possible
  let grantType = null;
  let grantValue = null;
  
  const cachedRefreshToken = await getOrUpdateCachedRefreshToken(code);
  if (!cachedRefreshToken) {
    log.info('Cannot find a cached refresh_token.');
    grantType = 'authorization_code';
    grantValue = code;
  } else {
    log.info('Using a cached refresh_token.');
    grantType = 'refresh_token';
    grantValue = cachedRefreshToken;
  }
  
  const form = new FormData();
  form.set('grant_type', grantType);
  form.set('client_id', config.app.id);
  form.set('client_secret', config.app.secret);
  form.set('redirect_uri', 'http://localhost/token');
  if (grantType === 'authorization_code') {
    form.set('code', grantValue);
  }
  if (grantType === 'refresh_token') {
    form.set('refresh_token', grantValue);
  }
  const settings = {
    method: 'POST',
    body: form
  };
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const response = await fetch(tokenUrl, settings);
  
  // check status
  if (response.status !== 200) {
    const responseText = await response.text();
    log.fatal(`Token endpoint returned ${response.status}: ${responseText}`);
  }
  
  // check fields
  const result = await response.json();
  if (!result.access_token || !result.refresh_token) {
    const responseText = await response.text();
    log.fatal(`Token endpoint did not return a token: ${responseText}`);
  }
  
  log.success(`Tokens retrieved successfully (${response.status}) using ${grantType}.`);
  await getOrUpdateCachedRefreshToken(code, result.refresh_token);
  log.info(`Cached the new refresh_token to ${cachedRefreshTokenPath}.`);

  return result.access_token || null;
};

const graphSendEmail = async (template) => {
  
  const token = await getToken(template.code);
  
  // get email details
  const aboutResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
  });
  
  // check status
  if (aboutResponse.status !== 200) {
    const responseText = await aboutResponse.text();
    log.fatal(`Unable to get email details (${aboutResponse.status}): ${responseText}`);
  }
  
  // check fields
  const about = await aboutResponse.json();
  if (!about.displayName || !about.userPrincipalName) {
    const responseText = await aboutResponse.text();
    log.fatal(`Unable to extract email details: ${responseText}`);
  }
  log.info(`Sending email from: ${about.displayName} <${about.userPrincipalName}>`);
  
  // send email
  const body = {
    message: {
      subject: template.subject,
      body: {
        contentType: 'Text',
        content: template.message
      },
      toRecipients: [{
        emailAddress: {
          address: template.to.address,
          name: template.to.name
        }
      }],
      singleValueExtendedProperties: [{
        id: 'Integer 0x3fde',
        value: '28592' // code page for ISO 8859-2 which is 28592
      }]
    },
    saveToSentItems: true
  };
  
  // process attachments
  for (let i = 0; i < template.attachments.length; i++) {
    if (!body.message.attachments) {
      body.message.attachments = [];
    }
    const at = template.attachments[i];
    body.message.attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: at.filename,
      contentType: at.contentType,
      contentBytes: at.content
    });
  }
  
  const sendResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  
  if (sendResponse.status === 202) {
    log.success(`Email sent sucessfully (${sendResponse.status}).`);
  } else {
    const responseText = await sendResponse.text();
    log.error(`Email failed to send (${sendResponse.status}): {${responseText}}`);
  }
};

const main = async () => {
  
  invoice.items = buildItemsFromArguments();
  
  const invoiceDate = getInvoiceDate();
  const monthNumber = invoiceDate.month() + 1;
  const dict = {
    monthNumber: monthNumber,
    monthName: invoiceDate.format('MMMM'),
    year: invoiceDate.year(),
    invoiceNumber: `${monthNumber}-1-1`
  };
  
  log.info('Placeholders:');
  log.info(dict);
  
  invoice.invoiceId = dict.monthNumber;
  invoice.invoiceMonth = dict.monthNumber;
  invoice.invoiceYear = dict.year;
  
  log.info('Invoice JSON:');
  log.info(invoice);
  
  const settings = {
    method: 'POST',
    body: JSON.stringify(invoice),
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const url = 'https://racuni.radiance.hr/generate';
  
  log.info(`Generating PDF via ${url}...`);
  const response = await fetch(url, settings);
  
  if (response.status !== 200) {
    log.error(`Returned ${response.status}, cannot continue.`);
    const content = await response.text();
    log.error(`Response:\n${content}`);
    log.fatal();
  }
  
  const raw = await response.arrayBuffer();
  if (raw.byteLength < 15000) {
    log.fatal(`PDF size suspiciously low (${raw.byteLength} bytes)`);
  }
  
  log.success(`Returned ${response.status} and a PDF of ${raw.byteLength} bytes`);
  
  const pdf = {
    filename: `${dict.year}-${dict.invoiceNumber}.pdf`,
    buffer: Buffer.from(raw)
  };
  
  // save file for preview
  await fs.promises.mkdir(config.directory, { recursive: true });
  const previewPath = path.join(config.directory, pdf.filename);
  await fs.promises.writeFile(previewPath, pdf.buffer);
  log.success(`PDF saved to ${previewPath}`);

  // for every template
  for (let i = 0; i < config.templates.length; i++) {
    
    const template = config.templates[i];
    
    for (let key in dict) {
      template.subject = template.subject.replaceAll(`{${key}}`, dict[key]);
      template.message = template.message.replaceAll(`{${key}}`, dict[key]);
    }
    
    template.attachments = [{
      filename: pdf.filename,
      content: pdf.buffer.toString('base64'),
      contentType: 'application/pdf'
    }];
    
    log.sep();
    log.info('Email to send:');
    log.info({
      code: template.code,
      to: template.to,
      subject: template.subject,
      message: template.message,
      attachment: template.attachments[0].filename
    });
    
    const answer = await question('Send this email? [y/N] ');
    if (answer.trim().toLowerCase() === 'y') {
      await graphSendEmail(template);
    } else {
      log.error('Email NOT sent.');
    }
    
  }
  
  rl.close();
};

main();