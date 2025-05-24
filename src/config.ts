import dotenv from 'dotenv';

dotenv.config();

export const config = {
  bot: {
    token: process.env.BOT_TOKEN || '7549503762:AAFxjhXj42_NPliLO0HW7MJ_D0D8bcZJWPw',
    adminId: parseInt(process.env.ADMIN_ID || '8173465652'),
  },
  paths: {
    temp: './downloads/temp',
    result: './downloads/result',
    archive: './downloads/result.zip'
  },
  formats: ['gif', 'png', 'jpg', 'webp', 'webm', 'tgs'],
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: './logs/bot.log'
  }
};

export default config;