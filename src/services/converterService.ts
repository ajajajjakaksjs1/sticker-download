import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConversionResult, StickerInfo } from '../types';
import config from '../config';
import logger from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';

const execAsync = promisify(exec);

export class ConverterService {
  private static readonly SUPPORTED_FORMATS = ['png', 'jpg', 'webp', 'gif'];

  async convertSticker(
    inputPath: string, 
    stickerInfo: StickerInfo, 
    outputPrefix: string
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    const inputExt = FileUtils.getFileExtension(inputPath);
    
    logger.info(`Converting sticker: ${inputPath} (${inputExt})`);

    try {
      // Определяем тип стикера и доступные форматы
      if (stickerInfo.isAnimated || inputExt === 'tgs') {
        // TGS (Lottie) стикеры - конвертируем в GIF и PNG
        await this.convertTgsSticker(inputPath, outputPrefix, results);
      } else if (stickerInfo.isVideo || inputExt === 'webm') {
        // WEBM видео стикеры - конвертируем в GIF и PNG
        await this.convertWebmSticker(inputPath, outputPrefix, results);
      } else {
        // Обычные статичные стикеры
        await this.convertStaticSticker(inputPath, outputPrefix, results);
      }

      logger.info(`Conversion completed: ${results.length} formats`);
      return results;
    } catch (error) {
      logger.error(`Conversion error for ${inputPath}:`, error);
      return results;
    }
  }

  private async convertStaticSticker(
    inputPath: string, 
    outputPrefix: string, 
    results: ConversionResult[]
  ): Promise<void> {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // PNG с прозрачностью
    const pngPath = path.join(config.paths.result, 'png', FileUtils.generateFileName(outputPrefix, 'png'));
    await image
      .png({ quality: 100, compressionLevel: 6 })
      .toFile(pngPath);
    
    results.push({
      format: 'png',
      path: pngPath,
      size: (await fs.stat(pngPath)).size
    });

    // JPG с белым фоном
    const jpgPath = path.join(config.paths.result, 'jpg', FileUtils.generateFileName(outputPrefix, 'jpg'));
    await image
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 95 })
      .toFile(jpgPath);
    
    results.push({
      format: 'jpg',
      path: jpgPath,
      size: (await fs.stat(jpgPath)).size
    });

    // WEBP с прозрачностью
    const webpPath = path.join(config.paths.result, 'webp', FileUtils.generateFileName(outputPrefix, 'webp'));
    await image
      .webp({ quality: 95, lossless: false })
      .toFile(webpPath);
    
    results.push({
      format: 'webp',
      path: webpPath,
      size: (await fs.stat(webpPath)).size
    });
  }

  private async convertTgsSticker(
    inputPath: string, 
    outputPrefix: string, 
    results: ConversionResult[]
  ): Promise<void> {
    try {
      // Для TGS стикеров нужен lottie-convert или rlottie
      // Пока создаем заглушку PNG
      const pngPath = path.join(config.paths.result, 'png', FileUtils.generateFileName(outputPrefix, 'png'));
      
      // Создаем простую заглушку для TGS
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .png()
      .toFile(pngPath);

      results.push({
        format: 'png',
        path: pngPath,
        size: (await fs.stat(pngPath)).size
      });

      logger.warn(`TGS conversion not fully implemented for: ${inputPath}`);
    } catch (error) {
      logger.error(`TGS conversion error:`, error);
    }
  }

  private async convertWebmSticker(
    inputPath: string, 
    outputPrefix: string, 
    results: ConversionResult[]
  ): Promise<void> {
    try {
      // Конвертируем WEBM в GIF с помощью ffmpeg (если доступен)
      const gifPath = path.join(config.paths.result, 'gif', FileUtils.generateFileName(outputPrefix, 'gif'));
      
      try {
        await execAsync(`ffmpeg -i "${inputPath}" -vf "scale=512:512:flags=lanczos,palettegen" -y /tmp/palette.png`);
        await execAsync(`ffmpeg -i "${inputPath}" -i /tmp/palette.png -vf "scale=512:512:flags=lanczos,paletteuse" -y "${gifPath}"`);
        
        results.push({
          format: 'gif',
          path: gifPath,
          size: (await fs.stat(gifPath)).size
        });
      } catch (ffmpegError) {
        logger.warn(`FFmpeg not available for WEBM conversion: ${ffmpegError}`);
      }

      // Извлекаем первый кадр как PNG
      const pngPath = path.join(config.paths.result, 'png', FileUtils.generateFileName(outputPrefix, 'png'));
      
      try {
        await execAsync(`ffmpeg -i "${inputPath}" -vframes 1 -f image2 "${pngPath}"`);
        
        results.push({
          format: 'png',
          path: pngPath,
          size: (await fs.stat(pngPath)).size
        });
      } catch (frameError) {
        logger.warn(`Could not extract frame from WEBM: ${frameError}`);
        
        // Создаем заглушку
        await sharp({
          create: {
            width: 512,
            height: 512,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
        .png()
        .toFile(pngPath);

        results.push({
          format: 'png',
          path: pngPath,
          size: (await fs.stat(pngPath)).size
        });
      }
    } catch (error) {
      logger.error(`WEBM conversion error:`, error);
    }
  }

  async batchConvert(
    stickers: Array<{ path: string; info: StickerInfo; prefix: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<ConversionResult[]> {
    const allResults: ConversionResult[] = [];
    
    for (let i = 0; i < stickers.length; i++) {
      const { path: stickerPath, info, prefix } = stickers[i];
      
      if (onProgress) {
        onProgress(i + 1, stickers.length);
      }
      
      const results = await this.convertSticker(stickerPath, info, prefix);
      allResults.push(...results);
    }
    
    return allResults;
  }
}