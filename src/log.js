const path = require('node:path');
const util = require('node:util');

util.inspect.styles.string = 'magenta';
util.inspect.styles.number = 'cyan';

const color = (colorCode, text) => {
  return `\x1b[${colorCode}m${text}\x1b[0m`;
};

const print = (colorCode, label, text) => {
  if (text) {
    console.log(`[${color(colorCode, label)}] %s`, text);
  }
};

const info = (item) => {
  if (item) {
    if (typeof item === 'string') {
      print(94, 'INFO', item);
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

const success = (text) => print(32, 'SUCCESS', text);
const error = (text) => print(91, 'ERROR', text);

const fatal = (text) => {
  error(text);
  process.exit(1);
};

const usage = () => {
  const script = path.basename(process.argv[1] || 'racuni');
  const text = `${color(35, 'racuni 1.1')}\n` +
               `usage: ${script} ${color(91, '[days]')}x${color(91, '[daily-rate-in-€]')}...\n` +
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