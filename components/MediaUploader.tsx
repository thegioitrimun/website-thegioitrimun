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
    <section id={id} className="scroll-mt-32 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Media</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Ảnh sản phẩm</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ảnh đầu tiên sẽ là ảnh đại diện. Kéo thả thumbnail để reorder, hoặc bấm đặt ảnh bìa để đẩy lên đầu.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {images.length} ảnh trong gallery
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="overflow-hidden rounded-[1.6rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 xl:sticky xl:top-24 xl:self-start">
          {primaryImage ? (
            <div className="relative aspect-[4/3] overflow-hidden bg-background">
              <img src={primaryImage.previewUrl} alt="Ảnh đại diện sản phẩm" className="h-full w-full object-cover" />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircleIcon className="h-4 w-4" />
                Ảnh đại diện
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
          <div className="rounded-[1.45rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 p-4">
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
                className="group relative overflow-hidden rounded-[1.25rem] bg-card"
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Spinner className="h-6 w-6 text-white" />
                  </div>
                ) : null}

                {image.uploadStatus === 'error' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/55">
                    <XCircleIcon className="h-7 w-7 text-white" />
                  </div>
                ) : null}

                <div className="absolute left-2 top-2 rounded-full bg-black/58 px-2 py-1 text-[11px] font-semibold text-white">
                  #{index + 1}
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteImage(image.id)}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/58 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                  aria-label="Xóa ảnh"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>

                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    onClick={() => onMakePrimary(image.id)}
                    className={`w-full rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      index === 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-border bg-background text-foreground hover:border-primary/35 hover:text-primary'
                    }`}
                  >
                    {index === 0 ? 'Đang là ảnh bìa' : 'Đặt làm ảnh bìa'}
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
