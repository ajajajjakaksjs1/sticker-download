import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import config from '../config';
import logger from './logger';

export class FileUtils {
  static async ensureDirectories(): Promise<void> {
    try {
      await fs.ensureDir(config.paths.temp);
      await fs.ensureDir(config.paths.result);
      
      // Создаем папки для каждого формата
      for (const format of config.formats) {
        await fs.ensureDir(path.join(config.paths.result, format));
      }
      
      logger.info('Directories ensured');
    } catch (error) {
      logger.error('Error ensuring directories:', error);
      throw error;
    }
  }

  static async cleanTemp(): Promise<void> {
    try {
      await fs.emptyDir(config.paths.temp);
      logger.info('Temp directory cleaned');
    } catch (error) {
      logger.error('Error cleaning temp directory:', error);
    }
  }

  static async cleanResult(): Promise<void> {
    try {
      await fs.emptyDir(config.paths.result);
      // Пересоздаем папки для форматов
      for (const format of config.formats) {
        await fs.ensureDir(path.join(config.paths.result, format));
      }
      logger.info('Result directory cleaned');
    } catch (error) {
      logger.error('Error cleaning result directory:', error);
    }
  }

  static async createArchive(): Promise<string> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(config.paths.archive);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      output.on('close', () => {
        logger.info(`Archive created: ${archive.pointer()} bytes`);
        resolve(config.paths.archive);
      });

      archive.on('error', (err) => {
        logger.error('Archive error:', err);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(config.paths.result, false);
      archive.finalize();
    });
  }

  static getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase().slice(1);
  }

  static generateFileName(prefix: string, format: string, index?: number): string {
    const timestamp = Date.now();
    const indexStr = index !== undefined ? `_${index.toString().padStart(3, '0')}` : '';
    return `${prefix}${indexStr}_${timestamp}.${format}`;
  }
}