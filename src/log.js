const path = require('node:path');
const util = require('node:util');
const chalk = require('chalk');

util.inspect.styles.string = 'magenta';
util.inspect.styles.number = 'cyan';

const info = (item) => {
  if (item) {
    if (typeof item === 'string') {
      console.log(`[${chalk.blueBright('INFO')}] ${item}`);
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
    console.log(`[${chalk.greenBright('SUCCESS')}] ${text}`);
  }
};

const error = (text) => {
  if (text) {
    console.log(`[${chalk.redBright('ERROR')}] ${text}`);
  }
};

const fatal = (text) => {
  error(text);
  process.exit(1);
};

const usage = () => {
  const script = path.basename(process.argv[1] || 'racuni');
  const text = `${chalk.magenta('racuni 1.1')}\n` +
               `usage: ${script} ${chalk.redBright('[days]')}x${chalk.redBright('[daily-rate-in-€]')}...\n` +
               `example: ${script} 12x400 8x500`
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