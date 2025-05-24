import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

import config
from handlers import admin_router, sticker_router
from utils import ensure_dirs, logger

async def main():
    """Главная функция бота"""
    
    # Создаем бота
    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    
    # Создаем диспетчер
    dp = Dispatcher()
    
    # Регистрируем роутеры
    dp.include_router(admin_router)
    dp.include_router(sticker_router)
    
    # Создаем необходимые директории
    await ensure_dirs([
        config.DOWNLOADS_DIR,
        config.TEMP_DIR,
        config.RESULT_DIR
    ])
    
    logger.info("Bot starting...")
    logger.info(f"Admin ID: {config.ADMIN_ID}")
    
    try:
        # Запускаем бота
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Bot error: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")