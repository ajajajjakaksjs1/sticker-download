import os
from dotenv import load_dotenv

load_dotenv()

# Bot configuration
BOT_TOKEN = os.getenv('BOT_TOKEN', '7549503762:AAFxjhXj42_NPliLO0HW7MJ_D0D8bcZJWPw')
ADMIN_ID = int(os.getenv('ADMIN_ID', '8173465652'))

# Paths
DOWNLOADS_DIR = 'downloads'
TEMP_DIR = f'{DOWNLOADS_DIR}/temp'
RESULT_DIR = f'{DOWNLOADS_DIR}/result'
ARCHIVE_PATH = f'{DOWNLOADS_DIR}/result.zip'

# Supported formats
SUPPORTED_FORMATS = ['png', 'jpg', 'webp', 'gif']

# Messages
MESSAGES = {
    'start_admin': '🤖 Бот готов к работе!\nОтправьте стикер или ссылку на стикерпак.',
    'start_not_admin': '❌ Доступ запрещен.',
    'processing': '📁 Идет сохранение.',
    'sticker_pack_confirm': '*️⃣ действительно хотите, чтобы я скачал все что имеется из этого пака?',
    'yes': 'Да',
    'no': 'Нет',
    'error': '❌ Произошла ошибка при обработке.'
}