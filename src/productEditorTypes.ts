import type { ProductImage } from '../types';

export interface UnifiedImage {
  id: number | string;
  type: 'existing' | 'new';
  previewUrl: string;
  file?: File;
  originalImage?: ProductImage;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'error';
  image_path?: string;
}

export interface TempContentBlock {
  id: string;
  type: 'text' | 'image';
  content?: string;
  image_path?: string;
  image_url?: string;
  caption?: string;
  file?: File;
}

export interface ProductEditorSection {
  id: string;
  label: string;
  status?: 'complete' | 'warning' | 'pending';
}
