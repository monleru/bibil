const { createLogger, format, transports } = require('winston')
const { combine, printf } = format

const myFormat = printf(({ level, message }: any) => {
  switch (level) {
    case 'done':
      return `\x1b[36m${level}:\x1b[0m ${message}`
    case 'claim':
      return `\x1b[32m${level}:\x1b[0m ${message}`
    case 'info':
      return `\x1b[36m${level}:\x1b[0m ${message}`
    case 'error':
      return `\x1b[31m${level}:\x1b[0m ${message}`
    default:
      return `\x1b[90m${level}:\x1b[0m ${message}`
  }
})

const myCustomLevels = {
  levels: {
    done: 0,
    claim: 1,
    info: 2,
    error: 3,
  },
  colors: {
    done: 'green',
    claim: 'green',
    info: 'yellow',
    error: 'red',
  },
}

export const logger = createLogger({
  level: 'info',
  levels: myCustomLevels.levels,
  format: combine(myFormat),
  transports: [new transports.Console()],
})
