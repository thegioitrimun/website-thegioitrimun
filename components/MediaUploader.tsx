import React from 'react';
import { CheckCircleIcon, TrashIcon, XCircleIcon } from './icons';
import Spinner from './Spinner';
import { ImageDropzone } from './ImageDropzone';
import type { UnifiedImage } from '../src/productEditorTypes';

interface MediaUploaderProps {
  id?: string;
  images: UnifiedImage[];
  onFilesSelected: (files: File[]) => void;
  onDeleteImage: (id: number | string) => void;
  onMakePrimary: (id: number | string) => void;
  onDragStart: (event: React.DragEvent, position: number) => void;
  onDragEnter: (event: React.DragEvent, position: number) => void;
  onDrop: (event: React.DragEvent) => void;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  id,
  images,
  onFilesSelected,
  onDeleteImage,
  onMakePrimary,
  onDragStart,
  onDragEnter,
  onDrop,
}) => {
  const primaryImage = images[0];

  return (
    <section id={id} className="scroll-mt-32 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Media</p>
          <h3 className="mt-1 text-lg sm:text-xl font-bold text-foreground">Ảnh sản phẩm</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Ảnh đầu tiên sẽ là ảnh đại diện. Kéo thả thumbnail để reorder, hoặc bấm đặt ảnh bìa để đẩy lên đầu.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs font-semibold text-muted-foreground shrink-0">
          {images.length} ảnh trong gallery
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl shadow-xs xl:sticky xl:top-24 xl:self-start">
          {primaryImage ? (
            <div className="relative aspect-[4/3] overflow-hidden bg-background">
              <img src={primaryImage.previewUrl} alt="Ảnh đại diện sản phẩm" className="h-full w-full object-cover" />
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                <span>Ảnh đại diện</span>
              </div>
            </div>
          ) : (
            <div className="aspect-[4/3]">
              <ImageDropzone
                onFilesSelected={onFilesSelected}
                multiple
                label="Kéo ảnh sản phẩm vào đây hoặc"
                buttonLabel="chọn từ máy"
                helpText="Khuyến nghị 1600x1600px, nền sạch, ưu tiên packshot và texture."
                className="h-full"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-4">
            <ImageDropzone
              onFilesSelected={onFilesSelected}
              multiple
              label="Thêm nhiều ảnh cùng lúc hoặc"
              buttonLabel="chọn ảnh"
              helpText="JPG, PNG, WEBP. Ảnh đầu tiên là cover, các ảnh còn lại là gallery."
              className="min-h-[168px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2" onDragOver={(event) => event.preventDefault()}>
            {images.map((image, index) => (
              <div
                key={image.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-xs transition-all hover:border-primary/40"
                draggable
                onDragStart={(event) => onDragStart(event, index)}
                onDragEnter={(event) => onDragEnter(event, index)}
                onDrop={onDrop}
                onDragOver={(event) => event.preventDefault()}
              >
                <div className="aspect-square overflow-hidden bg-muted/20">
                  <img src={image.previewUrl} alt={`Ảnh sản phẩm ${index + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>

                {image.uploadStatus === 'uploading' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-xs">
                    <Spinner className="h-6 w-6 text-white" />
                  </div>
                ) : null}

                {image.uploadStatus === 'error' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/55 backdrop-blur-xs">
                    <XCircleIcon className="h-7 w-7 text-white" />
                  </div>
                ) : null}

                <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white">
                  #{index + 1}
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteImage(image.id)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-black/60 backdrop-blur-md text-white opacity-0 transition-all hover:bg-red-600 active:scale-95 group-hover:opacity-100"
                  aria-label="Xóa ảnh"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>

                <div className="p-2.5">
                  <button
                    type="button"
                    onClick={() => onMakePrimary(image.id)}
                    className={`w-full rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      index === 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border/60 bg-background/50 text-foreground hover:bg-muted'
                    }`}
                  >
                    {index === 0 ? 'Ảnh bìa' : 'Đặt làm ảnh bìa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MediaUploader;
