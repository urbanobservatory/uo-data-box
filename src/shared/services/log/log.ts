import * as log from 'winston'
const toYAML = require('winston-console-formatter')

const logColours = {
  error: 'red',
  warn: 'cyan',
  info: 'green',
  verbose: 'yellow',
  debug: 'purple',
  silly: 'purple',
}

const logDebug = process.argv.join(' ').indexOf('--debug') >= 0
const logVerbose = process.argv.join(' ').indexOf('--verbose') >= 0

function getLogLevel() {
  if (logDebug) return 'debug'
  if (logVerbose) return 'verbose'
  return 'info'
}

log.configure({
  level: getLogLevel(),
})
log.add(
  log.transports.Console,
  toYAML.config(
    {},
    {
      colors: logColours,
    }
  )
)
log.addColors(logColours)

export { log }
