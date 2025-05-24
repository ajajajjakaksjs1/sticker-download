import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import config from '../config';

// Создаем директорию для логов
const logsDir = path.dirname(config.logging.file);
fs.ensureDirSync(logsDir);

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sticker-bot' },
  transports: [
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    })
  ]
});

export default logger;