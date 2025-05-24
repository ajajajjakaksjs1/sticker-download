import os
import gzip
import json
import subprocess
from typing import List, Dict, Any
from PIL import Image, ImageSequence
import logging
from pathlib import Path
import tempfile
import shutil

logger = logging.getLogger(__name__)

class StickerConverter:
    """Конвертер стикеров в различные форматы"""
    
    def __init__(self):
        self.supported_formats = ['png', 'jpg', 'webp', 'gif']
    
    async def convert_sticker(self, file_path: str, output_dir: str, filename_prefix: str) -> List[Dict[str, Any]]:
        """Конвертирует стикер во все поддерживаемые форматы"""
        results = []
        file_ext = Path(file_path).suffix.lower()
        
        logger.info(f"Converting sticker: {file_path} ({file_ext})")
        
        try:
            if file_ext == '.tgs':
                results = await self._convert_tgs(file_path, output_dir, filename_prefix)
            elif file_ext == '.webm':
                results = await self._convert_webm(file_path, output_dir, filename_prefix)
            elif file_ext in ['.webp', '.png', '.jpg', '.jpeg']:
                results = await self._convert_static(file_path, output_dir, filename_prefix)
            else:
                logger.warning(f"Unsupported format: {file_ext}")
                
        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            
        logger.info(f"Conversion completed: {len(results)} formats")
        return results
    
    async def _convert_tgs(self, tgs_path: str, output_dir: str, filename_prefix: str) -> List[Dict[str, Any]]:
        """Конвертирует TGS (Lottie) стикер"""
        results = []
        
        try:
            # Распаковываем TGS (это gzip архив с JSON)
            with gzip.open(tgs_path, 'rt') as f:
                lottie_data = json.load(f)
            
            # Создаем PNG используя rlottie
            png_path = os.path.join(output_dir, 'png', f"{filename_prefix}.png")
            os.makedirs(os.path.dirname(png_path), exist_ok=True)
            
            if await self._create_png_from_lottie(lottie_data, png_path):
                results.append({
                    'format': 'png',
                    'path': png_path,
                    'size': os.path.getsize(png_path)
                })
                
                # Создаем остальные форматы из PNG
                await self._convert_from_png(png_path, output_dir, filename_prefix, results)
                
                # Создаем GIF анимацию
                gif_path = os.path.join(output_dir, 'gif', f"{filename_prefix}.gif")
                if await self._create_gif_from_lottie(lottie_data, gif_path):
                    results.append({
                        'format': 'gif',
                        'path': gif_path,
                        'size': os.path.getsize(gif_path)
                    })
                    
        except Exception as e:
            logger.error(f"TGS conversion failed: {e}")
            
        return results
    
    async def _convert_webm(self, webm_path: str, output_dir: str, filename_prefix: str) -> List[Dict[str, Any]]:
        """Конвертирует WEBM стикер"""
        results = []
        
        try:
            # Конвертируем WEBM в PNG (первый кадр)
            png_path = os.path.join(output_dir, 'png', f"{filename_prefix}.png")
            os.makedirs(os.path.dirname(png_path), exist_ok=True)
            
            cmd = [
                'ffmpeg', '-i', webm_path, '-vframes', '1', 
                '-f', 'png', '-y', png_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0 and os.path.exists(png_path):
                results.append({
                    'format': 'png',
                    'path': png_path,
                    'size': os.path.getsize(png_path)
                })
                
                # Создаем остальные форматы из PNG
                await self._convert_from_png(png_path, output_dir, filename_prefix, results)
                
                # Конвертируем WEBM в GIF
                gif_path = os.path.join(output_dir, 'gif', f"{filename_prefix}.gif")
                os.makedirs(os.path.dirname(gif_path), exist_ok=True)
                
                cmd_gif = [
                    'ffmpeg', '-i', webm_path, '-vf', 
                    'fps=15,scale=512:-1:flags=lanczos,palettegen=reserve_transparent=1',
                    '-y', gif_path
                ]
                
                result_gif = subprocess.run(cmd_gif, capture_output=True, text=True)
                if result_gif.returncode == 0 and os.path.exists(gif_path):
                    results.append({
                        'format': 'gif',
                        'path': gif_path,
                        'size': os.path.getsize(gif_path)
                    })
                    
        except Exception as e:
            logger.error(f"WEBM conversion failed: {e}")
            
        return results
    
    async def _convert_static(self, image_path: str, output_dir: str, filename_prefix: str) -> List[Dict[str, Any]]:
        """Конвертирует статичное изображение"""
        results = []
        
        try:
            with Image.open(image_path) as img:
                # Конвертируем в RGBA для прозрачности
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                
                # PNG
                png_path = os.path.join(output_dir, 'png', f"{filename_prefix}.png")
                os.makedirs(os.path.dirname(png_path), exist_ok=True)
                img.save(png_path, 'PNG')
                results.append({
                    'format': 'png',
                    'path': png_path,
                    'size': os.path.getsize(png_path)
                })
                
                # Создаем остальные форматы
                await self._convert_from_png(png_path, output_dir, filename_prefix, results)
                
        except Exception as e:
            logger.error(f"Static image conversion failed: {e}")
            
        return results
    
    async def _convert_from_png(self, png_path: str, output_dir: str, filename_prefix: str, results: List[Dict[str, Any]]):
        """Создает JPG и WEBP из PNG"""
        try:
            with Image.open(png_path) as img:
                # JPG с белым фоном
                jpg_path = os.path.join(output_dir, 'jpg', f"{filename_prefix}.jpg")
                os.makedirs(os.path.dirname(jpg_path), exist_ok=True)
                
                jpg_img = Image.new('RGB', img.size, (255, 255, 255))
                jpg_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                jpg_img.save(jpg_path, 'JPEG', quality=95)
                
                results.append({
                    'format': 'jpg',
                    'path': jpg_path,
                    'size': os.path.getsize(jpg_path)
                })
                
                # WEBP
                webp_path = os.path.join(output_dir, 'webp', f"{filename_prefix}.webp")
                os.makedirs(os.path.dirname(webp_path), exist_ok=True)
                img.save(webp_path, 'WEBP', quality=95)
                
                results.append({
                    'format': 'webp',
                    'path': webp_path,
                    'size': os.path.getsize(webp_path)
                })
                
        except Exception as e:
            logger.error(f"PNG conversion failed: {e}")
    
    async def _create_png_from_lottie(self, lottie_data: Dict[str, Any], output_path: str) -> bool:
        """Создает PNG из Lottie данных"""
        try:
            # Используем rlottie для рендеринга
            import rlottie
            
            # Создаем временный файл с Lottie данными
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(lottie_data, f)
                temp_lottie = f.name
            
            try:
                # Рендерим первый кадр
                animation = rlottie.LottieAnimation.from_file(temp_lottie)
                frame = animation.render_pillow_frame(0)
                frame.save(output_path, 'PNG')
                return True
                
            finally:
                os.unlink(temp_lottie)
                
        except Exception as e:
            logger.error(f"Lottie PNG creation failed: {e}")
            # Fallback: создаем простой PNG с информацией о стикере
            try:
                img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
                
                # Добавляем простой текст
                try:
                    from PIL import ImageDraw, ImageFont
                    draw = ImageDraw.Draw(img)
                    
                    # Пытаемся загрузить шрифт
                    try:
                        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
                    except:
                        font = ImageFont.load_default()
                    
                    # Рисуем текст по центру
                    text = "TGS Sticker"
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    x = (512 - text_width) // 2
                    y = (512 - text_height) // 2
                    
                    draw.text((x, y), text, fill=(100, 100, 100, 255), font=font)
                    
                except Exception:
                    pass
                
                img.save(output_path, 'PNG')
                return True
            except:
                return False
    
    async def _create_gif_from_lottie(self, lottie_data: Dict[str, Any], output_path: str) -> bool:
        """Создает GIF анимацию из Lottie данных"""
        try:
            import rlottie
            
            # Создаем временный файл с Lottie данными
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(lottie_data, f)
                temp_lottie = f.name
            
            try:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Рендерим анимацию
                animation = rlottie.LottieAnimation.from_file(temp_lottie)
                frames = []
                
                # Ограничиваем количество кадров
                total_frames = min(animation.totalframe, 30)
                
                for i in range(total_frames):
                    frame = animation.render_pillow_frame(i)
                    frames.append(frame)
                
                if frames:
                    # Создаем GIF
                    frames[0].save(
                        output_path,
                        save_all=True,
                        append_images=frames[1:],
                        duration=50,  # 50ms между кадрами
                        loop=0,
                        disposal=2
                    )
                    logger.info(f"GIF created with {len(frames)} frames")
                    return True
                    
            finally:
                os.unlink(temp_lottie)
                
        except Exception as e:
            logger.error(f"Lottie GIF creation failed: {e}")
            # Fallback: создаем простой статичный GIF
            try:
                img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
                
                # Добавляем простой текст
                try:
                    from PIL import ImageDraw, ImageFont
                    draw = ImageDraw.Draw(img)
                    
                    # Пытаемся загрузить шрифт
                    try:
                        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
                    except:
                        font = ImageFont.load_default()
                    
                    # Рисуем текст по центру
                    text = "TGS Sticker"
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    x = (512 - text_width) // 2
                    y = (512 - text_height) // 2
                    
                    draw.text((x, y), text, fill=(100, 100, 100, 255), font=font)
                    
                except Exception:
                    pass
                
                # Создаем простой GIF из одного кадра
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                img.save(output_path, 'GIF', duration=1000, loop=0)
                return True
            except:
                return False