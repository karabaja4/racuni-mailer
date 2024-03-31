const config = require('./config.json');
const chalk = require('chalk');
const validator = require('email-validator');

const isAddressObjectValid = (obj) => {
  return obj?.name && obj?.address && validator.validate(obj.address);
}

const isTemplateValid = (template) => {
  return template?.username &&
    template?.password &&
    isAddressObjectValid(template?.from) &&
    isAddressObjectValid(template?.to) &&
    template?.subject &&
    template?.message;
}

const isValid = () => {
  if (!config.templates || config.templates.length === 0) {
    return false;
  } else {
    for (let i = 0; i < config.templates.length; i++) {
      if (!isTemplateValid(config.templates[i])) {
        return false;
      }
    }
  }
  return true;
}

const get = () => {
  if (!isValid()) {
    console.log(chalk.red('Invalid config.json'));
    process.exit(1);
  }
  return config;
}

module.exports = {
  get
};
