const chalk = require('chalk');
const colorize = require('json-colorizer');

const info = (text) => {
  if (text) {
    try {
      console.log(colorize(text, { pretty: true }));
    } catch {
      console.log(text);
    }
  }
};

const success = (text) => {
  if (text) {
    console.log(chalk.green(text));
  }
};

const error = (text) => {
  if (text) {
    console.log(chalk.red(text));
  }
};

const fatal = (text) => {
  error(text);
  process.exit(1);
};

const usage = () => {
  console.log(chalk.magenta('racuni 1.1'));
  console.log(`usage: racuni ${chalk.green('(days)')}x${chalk.green('(daily-rate-in-€)')}...`);
  console.log('example: racuni 12x400 8x500');
  process.exit(2);
};

module.exports = {
  info,
  success,
  error,
  fatal,
  usage
};