import os
import re
import aiohttp
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

import config
from utils import ensure_dirs, clean_dir, download_file, create_archive, logger
from converter import StickerConverter

# Роутеры
admin_router = Router()
sticker_router = Router()

# Состояния
class StickerPackStates(StatesGroup):
    waiting_confirmation = State()

# Инициализация конвертера
converter = StickerConverter()

@admin_router.message(Command("start"))
async def start_command(message: Message):
    """Обработка команды /start"""
    if message.from_user.id == config.ADMIN_ID:
        await message.answer(config.MESSAGES['start_admin'])
        logger.info(f"Start command from admin {message.from_user.id} (@{message.from_user.username})")
    else:
        await message.answer(config.MESSAGES['start_not_admin'])
        logger.warning(f"Unauthorized start command from {message.from_user.id} (@{message.from_user.username})")

@sticker_router.message(F.sticker)
async def handle_sticker(message: Message):
    """Обработка одиночного стикера"""
    if message.from_user.id != config.ADMIN_ID:
        return
    
    try:
        # Отправляем сообщение о начале обработки
        status_msg = await message.answer(config.MESSAGES['processing'])
        
        # Подготавливаем директории
        await ensure_dirs([
            config.TEMP_DIR,
            f"{config.RESULT_DIR}/png",
            f"{config.RESULT_DIR}/jpg", 
            f"{config.RESULT_DIR}/webp",
            f"{config.RESULT_DIR}/gif"
        ])
        
        await clean_dir(config.TEMP_DIR)
        await clean_dir(config.RESULT_DIR)
        
        # Скачиваем стикер
        file_info = await message.bot.get_file(message.sticker.file_id)
        file_url = f"https://api.telegram.org/file/bot{config.BOT_TOKEN}/{file_info.file_path}"
        
        # Определяем расширение файла
        file_ext = '.tgs' if message.sticker.is_animated else '.webp'
        if message.sticker.is_video:
            file_ext = '.webm'
            
        sticker_path = os.path.join(config.TEMP_DIR, f"sticker{file_ext}")
        await download_file(file_url, sticker_path)
        
        # Конвертируем стикер
        results = await converter.convert_sticker(sticker_path, config.RESULT_DIR, "sticker")
        
        if results:
            # Создаем архив
            archive_size = await create_archive(config.RESULT_DIR, config.ARCHIVE_PATH)
            
            # Отправляем архив
            archive_file = FSInputFile(config.ARCHIVE_PATH, filename="result.zip")
            await message.answer_document(archive_file)
            
            # Удаляем статусное сообщение
            await status_msg.delete()
            
            logger.info(f"Single sticker processed successfully: {len(results)} formats")
        else:
            await status_msg.edit_text(config.MESSAGES['error'])
            
    except Exception as e:
        logger.error(f"Error processing sticker: {e}")
        await message.answer(config.MESSAGES['error'])

@sticker_router.message(F.text.regexp(r'https://t\.me/addstickers/\w+'))
async def handle_sticker_pack_link(message: Message, state: FSMContext):
    """Обработка ссылки на стикерпак"""
    if message.from_user.id != config.ADMIN_ID:
        return
    
    # Извлекаем название стикерпака
    pack_name = re.search(r'https://t\.me/addstickers/(\w+)', message.text).group(1)
    
    # Сохраняем название пака в состояние
    await state.update_data(pack_name=pack_name)
    await state.set_state(StickerPackStates.waiting_confirmation)
    
    # Создаем клавиатуру с кнопками
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=config.MESSAGES['yes'], callback_data="confirm_yes"),
            InlineKeyboardButton(text=config.MESSAGES['no'], callback_data="confirm_no")
        ]
    ])
    
    await message.answer(config.MESSAGES['sticker_pack_confirm'], reply_markup=keyboard, parse_mode=None)
    logger.info(f"Sticker pack link received: {pack_name}")

@sticker_router.callback_query(F.data == "confirm_yes")
async def confirm_download_pack(callback: CallbackQuery, state: FSMContext):
    """Подтверждение скачивания стикерпака"""
    if callback.from_user.id != config.ADMIN_ID:
        await callback.answer("❌ Доступ запрещен")
        return
    
    try:
        # Получаем данные из состояния
        data = await state.get_data()
        pack_name = data.get('pack_name')
        
        if not pack_name:
            await callback.answer("❌ Ошибка: название пака не найдено")
            return
        
        # Удаляем клавиатуру и обновляем сообщение
        await callback.message.edit_text(config.MESSAGES['processing'])
        
        # Подготавливаем директории
        await ensure_dirs([
            config.TEMP_DIR,
            f"{config.RESULT_DIR}/png",
            f"{config.RESULT_DIR}/jpg", 
            f"{config.RESULT_DIR}/webp",
            f"{config.RESULT_DIR}/gif"
        ])
        
        await clean_dir(config.TEMP_DIR)
        await clean_dir(config.RESULT_DIR)
        
        # Получаем информацию о стикерпаке
        sticker_set = await callback.bot.get_sticker_set(pack_name)
        
        logger.info(f"Processing sticker pack: {pack_name} ({len(sticker_set.stickers)} stickers)")
        
        total_results = []
        
        # Обрабатываем каждый стикер в паке
        for i, sticker in enumerate(sticker_set.stickers):
            try:
                # Скачиваем стикер
                file_info = await callback.bot.get_file(sticker.file_id)
                file_url = f"https://api.telegram.org/file/bot{config.BOT_TOKEN}/{file_info.file_path}"
                
                # Определяем расширение файла
                file_ext = '.tgs' if sticker.is_animated else '.webp'
                if sticker.is_video:
                    file_ext = '.webm'
                    
                sticker_path = os.path.join(config.TEMP_DIR, f"sticker_{i}{file_ext}")
                await download_file(file_url, sticker_path)
                
                # Конвертируем стикер
                results = await converter.convert_sticker(sticker_path, config.RESULT_DIR, f"sticker_{i}")
                total_results.extend(results)
                
                logger.info(f"Processed sticker {i+1}/{len(sticker_set.stickers)}")
                
            except Exception as e:
                logger.error(f"Error processing sticker {i}: {e}")
                continue
        
        if total_results:
            # Создаем архив
            archive_size = await create_archive(config.RESULT_DIR, config.ARCHIVE_PATH)
            
            # Отправляем архив
            archive_file = FSInputFile(config.ARCHIVE_PATH, filename="result.zip")
            await callback.message.answer_document(archive_file)
            
            # Удаляем сообщение о процессе
            await callback.message.delete()
            
            logger.info(f"Sticker pack processed successfully: {len(sticker_set.stickers)} stickers, {len(total_results)} files")
        else:
            await callback.message.edit_text(config.MESSAGES['error'])
            
    except Exception as e:
        logger.error(f"Error processing sticker pack: {e}")
        await callback.message.edit_text(config.MESSAGES['error'])
    
    finally:
        await state.clear()

@sticker_router.callback_query(F.data == "confirm_no")
async def cancel_download_pack(callback: CallbackQuery, state: FSMContext):
    """Отмена скачивания стикерпака"""
    await callback.message.delete()
    await state.clear()
    await callback.answer("Отменено")
    logger.info("Sticker pack download cancelled")