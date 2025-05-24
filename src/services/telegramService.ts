import { Telegraf } from 'telegraf';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { StickerInfo, StickerSet } from '../types';
import config from '../config';
import logger from '../utils/logger';

export class TelegramService {
  private bot: Telegraf;
  private apiUrl: string;

  constructor(bot: Telegraf) {
    this.bot = bot;
    this.apiUrl = `https://api.telegram.org/bot${config.bot.token}`;
  }

  async getStickerSet(name: string): Promise<StickerSet | null> {
    try {
      logger.info(`Getting sticker set: ${name}`);
      const response = await axios.get(`${this.apiUrl}/getStickerSet`, {
        params: { name }
      });

      if (response.data.ok) {
        const stickerSet = response.data.result;
        logger.info(`Sticker set found: ${stickerSet.title} (${stickerSet.stickers.length} stickers)`);
        return stickerSet;
      }
      
      logger.warn(`Sticker set not found: ${name}`);
      return null;
    } catch (error) {
      logger.error(`Error getting sticker set ${name}:`, error);
      return null;
    }
  }

  async getFile(fileId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/getFile`, {
        params: { file_id: fileId }
      });

      if (response.data.ok) {
        const filePath = response.data.result.file_path;
        return `https://api.telegram.org/file/bot${config.bot.token}/${filePath}`;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting file ${fileId}:`, error);
      return null;
    }
  }

  async downloadFile(url: string, outputPath: string): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000
      });

      await fs.ensureDir(path.dirname(outputPath));
      
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.debug(`File downloaded: ${outputPath}`);
          resolve(true);
        });
        writer.on('error', (error) => {
          logger.error(`Download error for ${url}:`, error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error(`Error downloading file from ${url}:`, error);
      return false;
    }
  }

  extractStickerPackName(url: string): string | null {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/addstickers\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
  }

  async getStickerInfo(sticker: any): Promise<StickerInfo> {
    return {
      fileId: sticker.file_id,
      fileUniqueId: sticker.file_unique_id,
      type: sticker.type || 'regular',
      width: sticker.width,
      height: sticker.height,
      isAnimated: sticker.is_animated || false,
      isVideo: sticker.is_video || false,
      thumbnail: sticker.thumbnail,
      emoji: sticker.emoji,
      setName: sticker.set_name,
      premiumAnimation: sticker.premium_animation,
      maskPosition: sticker.mask_position,
      customEmojiId: sticker.custom_emoji_id,
      needsRepainting: sticker.needs_repainting,
      fileSize: sticker.file_size
    };
  }
}