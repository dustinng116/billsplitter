import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

interface ImgBBUploadResponse {
  data: {
    url: string;
    display_url: string;
    delete_url: string;
  };
  success: boolean;
  status: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  constructor() {}

  async uploadImage(file: File): Promise<string> {
    if (!environment.imgbbApiKey) {
      throw new Error('ImgBB API key is missing. Please add it to environment.ts.');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${environment.imgbbApiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Image upload failed');
      }

      const result = (await response.json()) as ImgBBUploadResponse;
      if (result.success && result.data && result.data.url) {
        return result.data.url;
      } else {
        throw new Error('Invalid response from image upload service');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Optional: A helper method to compress image before upload using HTML canvas
  async compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(newFile);
              } else {
                reject(new Error('Canvas to Blob failed'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }
}
