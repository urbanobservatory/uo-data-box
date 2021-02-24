export interface BrokerConfig {
  requiredServices: (() => Promise<any>)[]
}
