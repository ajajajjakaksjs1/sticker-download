export interface StickerInfo {
  fileId: string;
  fileUniqueId: string;
  type: string;
  width: number;
  height: number;
  isAnimated: boolean;
  isVideo: boolean;
  thumbnail?: {
    fileId: string;
    fileUniqueId: string;
    width: number;
    height: number;
    fileSize?: number;
  };
  emoji?: string;
  setName?: string;
  premiumAnimation?: any;
  maskPosition?: any;
  customEmojiId?: string;
  needsRepainting?: boolean;
  fileSize?: number;
}

export interface StickerSet {
  name: string;
  title: string;
  stickerType: string;
  isAnimated: boolean;
  isVideo: boolean;
  stickers: StickerInfo[];
  thumbnail?: {
    fileId: string;
    fileUniqueId: string;
    width: number;
    height: number;
    fileSize?: number;
  };
}

export interface ConversionResult {
  format: string;
  path: string;
  size: number;
}

export interface ProcessingStatus {
  total: number;
  processed: number;
  current?: string;
  errors: string[];
}