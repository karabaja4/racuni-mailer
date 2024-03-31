const util = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

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

const mod = (n, m) => {
  return ((n % m) + m) % m;
};

// calculate end of month
// if before 15th, look at previous month
const getEndOfMonth = () => {
  const now = dayjs().tz('Europe/Zagreb');
  let month = now.month();
  if (now.date() <= 15) {
    month -= 1;
    month = mod(month, 12);
  }
  return dayjs.tz(new Date(now.year(), month, 1), 'Europe/Zagreb').endOf('month');
};

const main = async () => {
  
  invoice.items = buildItemsFromArguments();
  
  const now = getEndOfMonth();
  const monthNumber = now.month() + 1;
  const dict = {
    monthNumber: monthNumber,
    monthName: now.format('MMMM'),
    year: now.year(),
    invoiceNumber: `${monthNumber}-1-1`
  };
  
  log.info('Header:');
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
  
  const api = 'racuni.radiance.hr';
  const response = await fetch(`https://${api}/generate`, settings);
  
  if (response.status !== 200) {
    log.error(`${api} returned ${response.status}, cannot continue:`);
    const content = await response.text();
    log.info(content);
    log.fatal();
  }
  
  const raw = await response.arrayBuffer();
  if (raw.byteLength < 30000) {
    log.fatal(`PDF size suspiciously low (${raw.byteLength} bytes)`);
  }
  
  log.success(`${api} returned ${response.status} with PDF of ${raw.byteLength} bytes`);
  
  const pdf = {
    filename: `${dict.year}-${dict.invoiceNumber}.pdf`,
    buffer: Buffer.from(raw)
  };
  
  // save file for preview
  await fs.promises.mkdir(config.directory, { recursive: true });
  const previewPath = path.join(config.directory, pdf.filename);
  await fs.promises.writeFile(previewPath, pdf.buffer);
  log.success(`File saved at ${previewPath}`);

  // for every template
  for (let i = 0; i < config.templates.length; i++) {
    const template = config.templates[i];
    for (let key in dict) {
      template.subject = template.subject.replaceAll(`{${key}}`, dict[key]);
      template.message = template.message.replaceAll(`{${key}}`, dict[key]);
    }
    template.attachments = [{
      filename: pdf.filename,
      content: pdf.buffer,
      contentType: 'application/pdf'
    }];
    await send(template);
  }
  
  rl.close();
}

const send = async (template) => {
  
  log.info('Email to send:');
  const mail = {
    from: template.from,
    to: template.to,
    subject: template.subject,
    text: template.message
  };
  
  log.info(mail);
  
  mail.attachments = template.attachments;
  
  const answer = await question('Send this email? [y/N] ');
  if (answer.trim().toLowerCase() === 'y') {
    const transport = {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: template.username,
        pass: template.password,
      },
      tls: {
        ciphers: 'SSLv3'
      }
    };
    const transporter = nodemailer.createTransport(transport);
    const sentMessageInfo = await transporter.sendMail(mail);
    log.success(`Message sent to ${template.to.name} <${template.to.address}>\n${sentMessageInfo.messageId}`);
  } else {
    log.error('Email NOT sent.');
  }
}

main();