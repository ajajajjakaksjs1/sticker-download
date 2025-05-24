import { Telegraf } from 'telegraf';
import { TelegramService } from './services/telegramService';
import { StickerHandler } from './handlers/stickerHandler';
import { AdminHandler } from './handlers/adminHandler';
import { FileUtils } from './utils/fileUtils';
import config from './config';
import logger from './utils/logger';

class StickerBot {
  private bot: Telegraf;
  private telegramService: TelegramService;
  private stickerHandler: StickerHandler;

  constructor() {
    this.bot = new Telegraf(config.bot.token);
    this.telegramService = new TelegramService(this.bot);
    this.stickerHandler = new StickerHandler(this.telegramService);
    
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // Команда /start (доступна всем для проверки админа)
    this.bot.start(AdminHandler.handleStart);

    // Обработка стикеров (только для админа)
    this.bot.on('sticker', (ctx) => {
      this.stickerHandler.handleSingleSticker(ctx);
    });

    // Обработка текстовых сообщений (ссылки на стикерпаки)
    this.bot.on('text', (ctx) => {
      const text = ctx.message.text;
      
      // Проверяем, является ли сообщение ссылкой на стикерпак
      if (text.includes('t.me/addstickers/') || text.includes('telegram.me/addstickers/')) {
        this.stickerHandler.handleStickerPackUrl(ctx);
      }
    });

    // Обработка inline кнопок
    this.bot.action(/^download_pack:(.+)$/, (ctx) => {
      const packName = ctx.match[1];
      this.stickerHandler.handlePackDownload(ctx, packName);
    });

    this.bot.action('cancel_download', (ctx) => {
      this.stickerHandler.handleCancelDownload(ctx);
    });

    logger.info('Bot handlers configured');
  }

  private setupErrorHandling(): void {
    this.bot.catch((err, ctx) => {
      logger.error('Bot error:', err);
      
      if (ctx.reply) {
        ctx.reply('❌ Произошла ошибка при обработке запроса').catch(() => {});
      }
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully');
      this.stop();
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      this.stop();
    });
  }

  async start(): Promise<void> {
    try {
      // Инициализируем директории
      await FileUtils.ensureDirectories();
      
      // Запускаем бота
      await this.bot.launch();
      
      logger.info('🤖 Sticker bot started successfully');
      logger.info(`👤 Admin ID: ${config.bot.adminId}`);
      logger.info(`📁 Temp path: ${config.paths.temp}`);
      logger.info(`📦 Result path: ${config.paths.result}`);
      
      console.log('🚀 Bot is running...');
      console.log('Press Ctrl+C to stop');
      
    } catch (error) {
      logger.error('Failed to start bot:', error);
      console.error('❌ Bot startup failed:', error);
      process.exit(1);
    }
  }

  stop(): void {
    logger.info('Stopping bot...');
    this.bot.stop('SIGINT');
    process.exit(0);
  }
}

// Запуск бота
const bot = new StickerBot();
bot.start();