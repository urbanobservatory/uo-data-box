export class Config {
  static defaults: { [key: string]: string } = {}

  static addDefaults(values: { [key: string]: string }) {
    Config.defaults = {
      ...Config.defaults,
      ...values,
    }
  }

  static getValue(key: string): string {
    const envKey = `UO_${key.toUpperCase()}`
    const value = process.env[envKey]
    if (typeof value !== 'undefined') {
      return value
    }
    return Config.defaults[key]
  }
}
