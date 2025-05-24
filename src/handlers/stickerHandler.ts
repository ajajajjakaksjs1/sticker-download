import { Context } from 'telegraf';
import path from 'path';
import { TelegramService } from '../services/telegramService';
import { ConverterService } from '../services/converterService';
import { FileUtils } from '../utils/fileUtils';
import { AdminHandler } from './adminHandler';
import config from '../config';
import logger from '../utils/logger';

export class StickerHandler {
  private telegramService: TelegramService;
  private converterService: ConverterService;

  constructor(telegramService: TelegramService) {
    this.telegramService = telegramService;
    this.converterService = new ConverterService();
  }

  async handleSingleSticker(ctx: Context): Promise<void> {
    if (!AdminHandler.isAdmin(ctx)) return;

    const sticker = (ctx.message as any)?.sticker;
    if (!sticker) return;

    logger.info(`Processing single sticker: ${sticker.file_id}`);

    try {
      // Отправляем сообщение о начале обработки
      const processingMsg = await ctx.reply('📁 Идет сохранение...');

      // Очищаем временные папки
      await FileUtils.cleanTemp();
      await FileUtils.cleanResult();
      await FileUtils.ensureDirectories();

      // Получаем информацию о стикере
      const stickerInfo = await this.telegramService.getStickerInfo(sticker);
      
      // Скачиваем файл
      const fileUrl = await this.telegramService.getFile(sticker.file_id);
      if (!fileUrl) {
        throw new Error('Could not get file URL');
      }

      const fileExt = stickerInfo.isAnimated ? 'tgs' : 
                     stickerInfo.isVideo ? 'webm' : 'webp';
      const tempPath = path.join(config.paths.temp, `sticker.${fileExt}`);
      
      const downloaded = await this.telegramService.downloadFile(fileUrl, tempPath);
      if (!downloaded) {
        throw new Error('Download failed');
      }

      // Конвертируем стикер
      const results = await this.converterService.convertSticker(
        tempPath, 
        stickerInfo, 
        'sticker'
      );

      if (results.length === 0) {
        throw new Error('No conversion results');
      }

      // Создаем архив
      const archivePath = await FileUtils.createArchive();

      // Отправляем архив
      await ctx.replyWithDocument(
        { source: archivePath, filename: 'result.zip' },
        { 
          caption: `✅ *Готово!*\n\n📊 Форматов: ${results.length}\n🗂 Размер: ${this.formatFileSize(results.reduce((sum, r) => sum + r.size, 0))}`,
          parse_mode: 'Markdown'
        }
      );

      // Удаляем сообщение о процессе
      await ctx.deleteMessage(processingMsg.message_id);

      logger.info(`Single sticker processed successfully: ${results.length} formats`);

    } catch (error) {
      logger.error('Error processing single sticker:', error);
      await ctx.reply('❌ Ошибка при обработке стикера');
    }
  }

  async handleStickerPackUrl(ctx: Context): Promise<void> {
    if (!AdminHandler.isAdmin(ctx)) return;

    const text = (ctx.message as any)?.text;
    if (!text) return;

    const packName = this.telegramService.extractStickerPackName(text);
    if (!packName) return;

    logger.info(`Processing sticker pack URL: ${packName}`);

    try {
      // Получаем информацию о стикерпаке
      const stickerSet = await this.telegramService.getStickerSet(packName);
      if (!stickerSet) {
        await ctx.reply('❌ Стикерпак не найден');
        return;
      }

      // Отправляем подтверждение
      await ctx.reply(
        `🎯 *${stickerSet.title}*\n\n` +
        `📊 Стикеров: ${stickerSet.stickers.length}\n` +
        `🎭 Тип: ${stickerSet.isAnimated ? 'Анимированные' : stickerSet.isVideo ? 'Видео' : 'Статичные'}\n\n` +
        `*️⃣ Действительно хотите, чтобы я скачал все что имеется из этого пака?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Да', callback_data: `download_pack:${packName}` },
                { text: '❌ Нет', callback_data: 'cancel_download' }
              ]
            ]
          }
        }
      );

    } catch (error) {
      logger.error('Error processing sticker pack URL:', error);
      await ctx.reply('❌ Ошибка при получении информации о стикерпаке');
    }
  }

  async handlePackDownload(ctx: Context, packName: string): Promise<void> {
    if (!AdminHandler.isAdmin(ctx)) return;

    logger.info(`Starting pack download: ${packName}`);

    try {
      // Редактируем сообщение
      await ctx.editMessageText('📁 Идет сохранение...');

      // Получаем стикерпак
      const stickerSet = await this.telegramService.getStickerSet(packName);
      if (!stickerSet) {
        await ctx.editMessageText('❌ Стикерпак не найден');
        return;
      }

      // Очищаем папки
      await FileUtils.cleanTemp();
      await FileUtils.cleanResult();
      await FileUtils.ensureDirectories();

      const stickers = [];
      let processed = 0;

      // Скачиваем все стикеры
      for (let i = 0; i < stickerSet.stickers.length; i++) {
        const sticker = stickerSet.stickers[i];
        
        try {
          // Обновляем прогресс каждые 5 стикеров
          if (i % 5 === 0) {
            await ctx.editMessageText(
              `📁 Идет сохранение...\n\n` +
              `📊 Прогресс: ${i}/${stickerSet.stickers.length}\n` +
              `🎯 Текущий: ${sticker.emoji || '🔸'}`
            );
          }

          const stickerInfo = await this.telegramService.getStickerInfo(sticker);
          const fileUrl = await this.telegramService.getFile(stickerInfo.fileId);
          
          if (!fileUrl) continue;

          const fileExt = stickerInfo.isAnimated ? 'tgs' : 
                         stickerInfo.isVideo ? 'webm' : 'webp';
          const tempPath = path.join(config.paths.temp, `sticker_${i}.${fileExt}`);
          
          const downloaded = await this.telegramService.downloadFile(fileUrl, tempPath);
          if (downloaded) {
            stickers.push({
              path: tempPath,
              info: stickerInfo,
              prefix: `sticker_${i.toString().padStart(3, '0')}`
            });
            processed++;
          }

        } catch (error) {
          logger.error(`Error downloading sticker ${i}:`, error);
        }
      }

      if (stickers.length === 0) {
        await ctx.editMessageText('❌ Не удалось скачать ни одного стикера');
        return;
      }

      // Конвертируем все стикеры
      await ctx.editMessageText('🔄 Конвертация...');
      
      const allResults = await this.converterService.batchConvert(
        stickers,
        (current, total) => {
          // Обновляем прогресс конвертации каждые 10 стикеров
          if (current % 10 === 0) {
            ctx.editMessageText(
              `🔄 Конвертация...\n\n` +
              `📊 Прогресс: ${current}/${total}`
            ).catch(() => {}); // Игнорируем ошибки редактирования
          }
        }
      );

      // Создаем архив
      await ctx.editMessageText('📦 Создание архива...');
      const archivePath = await FileUtils.createArchive();

      // Отправляем результат
      await ctx.replyWithDocument(
        { source: archivePath, filename: `${packName}.zip` },
        { 
          caption: `✅ *Стикерпак готов!*\n\n` +
                  `📦 ${stickerSet.title}\n` +
                  `📊 Стикеров: ${processed}/${stickerSet.stickers.length}\n` +
                  `🗂 Форматов: ${allResults.length}\n` +
                  `💾 Размер: ${this.formatFileSize(allResults.reduce((sum, r) => sum + r.size, 0))}`,
          parse_mode: 'Markdown'
        }
      );

      // Удаляем сообщение с прогрессом
      await ctx.deleteMessage();

      logger.info(`Pack download completed: ${processed} stickers, ${allResults.length} files`);

    } catch (error) {
      logger.error('Error downloading sticker pack:', error);
      await ctx.editMessageText('❌ Ошибка при скачивании стикерпака');
    }
  }

  async handleCancelDownload(ctx: Context): Promise<void> {
    await ctx.editMessageText('❌ Скачивание отменено');
    logger.info('Pack download cancelled by user');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}