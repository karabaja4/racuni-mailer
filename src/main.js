const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const pdfparse = require('pdf-parse');
const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const chalk = require('chalk');
const colorize = require('json-colorizer');

dayjs.extend(require('dayjs/plugin/customParseFormat'));
const config = require('./config').get();

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = util.promisify(rl.question).bind(rl);

const error = (text) => {
  console.log(chalk.red(text));
  process.exit(1);
}

const main = async () => {

  // load
  const invoices = [];
  let files = null;
  try {
    files = await fs.promises.readdir(config.directory);
  } catch (e) {
    error(e.message);
  }
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    if (filename.endsWith('.pdf')) {
      const fullpath = path.join(config.directory, filename);
      const buffer = await fs.promises.readFile(fullpath);
      const data = await pdfparse(buffer);
      const lines = data.text.split('\n').filter(x => x);
      const title = 'Račun (Invoice)';
      if (lines[0] === title || lines[1] === title) {
        if (invoices.length > 0) {
          error('More than one invoice found!');
        }
        invoices.push({
          path: fullpath,
          lines: lines
        });
      }
    }
  }
  if (invoices.length !== 1) {
    error('Cannot find an invoice!');
  }

  // process
  const getValue = (lines, label) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(label)) {
        return lines[i].replace(label, '');
      }
    }
    error(`Cannot find line with label ${label}`);
  }

  const invoice = invoices[0];

  const amount = getValue(invoice.lines, 'Ukupan iznos naplate (Grand total):');
  const invoiceNumber = getValue(invoice.lines, 'Broj računa (Invoice number):');
  const dateText = getValue(invoice.lines, 'Datum isporuke (Delivery date):');

  console.log(chalk.blue(`Invoice ${invoiceNumber} for ${amount}`));
 
  const date = dayjs(dateText, 'DD.MM.YYYY.');
  if (!date.isValid()) {
    error('Cannot parse delivery date!');
  }

  const dict = {
    monthNumber: date.month() + 1,
    monthName: date.format('MMMM'),
    year: date.year(),
    invoiceNumber: invoiceNumber
  };

  for (let i = 0; i < config.templates.length; i++) {
    const template = config.templates[i];
    for (let key in dict) {
      template.message = template.message.replaceAll(`{${key}}`, dict[key]);
      template.subject = template.subject.replaceAll(`{${key}}`, dict[key]);
    }
    template.attachments = [{
      filename: path.basename(invoice.path),
      path: invoice.path
    }];
    await send(template);
  }
  await cleanup(invoice.path);
  rl.close();
}

const send = async (template) => {
  console.log('Email to send:');
  const mail = {
    from: template.from,
    to: template.to,
    subject: template.subject,
    text: template.message,
    attachments: template.attachments
  };
  console.log(colorize(JSON.stringify(mail, null, 2)));
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
    const info = await transporter.sendMail(mail);
    console.log(chalk.blue(`Message sent to ${template.to.name} <${template.to.address}>\n${info.messageId}`));
  } else {
    console.log(chalk.red('Email NOT sent.'));
  }
}

const cleanup = async (filepath) => {
  const answer = await question(`Delete ${filepath}? [y/N] `);
  if (answer.trim().toLowerCase() === 'y') {
    await fs.promises.unlink(filepath);
    console.log(chalk.blue(`Invoice deleted.`));
  } else {
    console.log(chalk.red(`Invoice NOT deleted.`));
  }
}

main();