const validator = require('email-validator');
const config = require('./config.json');
const log = require('./log');

const isAddressObjectValid = (obj) => {
  return obj?.name && obj?.address && validator.validate(obj.address);
}

const isTemplateValid = (template) => {
  return template?.label &&
    template?.code &&
    isAddressObjectValid(template?.to) &&
    template?.subject &&
    template?.message;
}

const isValid = () => {
  if (!config.directory ||
      !config.app?.id ||
      !config.app?.secret ||
      !config.templates ||
      (config.templates.length === 0)) {
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
    log.fatal('Invalid config.json');
  }
  return config;
}

module.exports = {
  get
};
