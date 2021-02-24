export class Config {
  static defaults: {[key: string]: string} = {};

  static addDefaults(values: {[key: string]: string}) {
    Config.defaults = {
      ...Config.defaults,
      ...values
    };
  }

  static getValue(key: string) {
    const envKey = `UO_${key.toUpperCase()}`;
    if (process.env[envKey]) {
      return process.env[envKey];
    }
    return Config.defaults[key];
  }
}
