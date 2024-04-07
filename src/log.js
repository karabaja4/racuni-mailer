const path = require('node:path');
const util = require('node:util');
const chalk = require('chalk');

const info = (item) => {
  if (item) {
    if (typeof item === 'string') {
      console.log(chalk.blue(item));
    } else {
      const settings = {
        colors: true,
        compact: false,
        depth: Infinity,
        breakLength: Infinity
      };
      console.log(util.inspect(item, settings));
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
  const script = path.basename(process.argv[1] || 'racuni');
  const text = `${chalk.magenta('racuni 1.1')}\n` +
               `usage: ${script} ${chalk.red('[days]')}x${chalk.red('[daily-rate-in-€]')}...\n` +
               `example: ${script} 12x400 8x500\n`
  console.log(text);
  process.exit(2);
};

module.exports = {
  info,
  success,
  error,
  fatal,
  usage
};