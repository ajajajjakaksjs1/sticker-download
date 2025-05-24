import { Context } from 'telegraf';
import config from '../config';
import logger from '../utils/logger';

export class AdminHandler {
  static isAdmin(ctx: Context): boolean {
    const userId = ctx.from?.id;
    const isAdmin = userId === config.bot.adminId;
    
    if (!isAdmin && userId) {
      logger.warn(`Unauthorized access attempt from user ${userId}`);
    }
    
    return isAdmin;
  }

  static async requireAdmin(ctx: Context, next: () => Promise<void>): Promise<void> {
    if (AdminHandler.isAdmin(ctx)) {
      await next();
    } else {
      logger.warn(`Access denied for user ${ctx.from?.id}`);
      await ctx.reply('❌ Доступ запрещен');
    }
  }

  static async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'Unknown';
    
    logger.info(`Start command from user ${userId} (@${username})`);
    
    if (AdminHandler.isAdmin(ctx)) {
      await ctx.reply(
        '🤖 *Стикер-бот активен*\n\n' +
        '📋 *Команды:*\n' +
        '• Отправь стикер — скачаю все форматы\n' +
        '• Отправь ссылку на стикерпак — скачаю весь пак\n\n' +
        '🎯 *Поддерживаемые форматы:*\n' +
        '• PNG (с прозрачностью)\n' +
        '• JPG (с белым фоном)\n' +
        '• WEBP (сжатый)\n' +
        '• GIF (для анимированных)\n\n' +
        '⚡ Все файлы упаковываются в архив',
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('❌ Бот доступен только администратору');
    }
  }
}