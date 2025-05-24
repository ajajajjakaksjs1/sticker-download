import os
import shutil
import zipfile
import logging
from typing import List
import aiofiles
import aiohttp
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def ensure_dirs(dirs: List[str]):
    """Создает необходимые директории"""
    for dir_path in dirs:
        os.makedirs(dir_path, exist_ok=True)
    logger.info(f"Directories ensured: {dirs}")

async def clean_dir(dir_path: str):
    """Очищает директорию"""
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path)
    os.makedirs(dir_path, exist_ok=True)
    logger.info(f"Directory cleaned: {dir_path}")

async def download_file(url: str, file_path: str):
    """Скачивает файл по URL"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                async with aiofiles.open(file_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        await f.write(chunk)
                logger.info(f"File downloaded: {file_path}")
            else:
                raise Exception(f"Failed to download file: {response.status}")

async def create_archive(source_dir: str, archive_path: str) -> int:
    """Создает ZIP архив из директории"""
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    
    size = os.path.getsize(archive_path)
    logger.info(f"Archive created: {archive_path} ({size} bytes)")
    return size

def get_file_extension(file_path: str) -> str:
    """Получает расширение файла"""
    return Path(file_path).suffix.lower().lstrip('.')

def generate_filename(prefix: str, extension: str) -> str:
    """Генерирует имя файла"""
    import time
    timestamp = int(time.time() * 1000)
    return f"{prefix}_{timestamp}.{extension}"