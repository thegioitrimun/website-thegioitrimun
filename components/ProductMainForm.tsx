import React from 'react';
import type { DetailFaqEntry, Product } from '../types';
import { PlusCircleIcon, SparklesIcon, TrashIcon } from './icons';
import Spinner from './Spinner';
import { ImageDropzone } from './ImageDropzone';
import MediaUploader from './MediaUploader';
import FAQEditor from './FAQEditor';
import type { TempContentBlock, UnifiedImage } from '../src/productEditorTypes';

interface ProductMainFormProps {
  formData: Partial<Product>;
  keyBenefitsText: string;
  skinTypesText: string;
  isGenerating: boolean;
  contentBlocks: TempContentBlock[];
  imageList: UnifiedImage[];
  faqItems: DetailFaqEntry[];
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onGenerateDetails: () => void;
  onKeyBenefitsChange: (value: string) => void;
  onSkinTypesChange: (value: string) => void;
  onAddContentBlock: (type: 'text' | 'image') => void;
  onUpdateContentBlock: (id: string, nextBlock: Partial<TempContentBlock>) => void;
  onRemoveContentBlock: (id: string) => void;
  onContentImageSelected: (id: string, files: File[]) => void;
  onImageFilesSelected: (files: File[]) => void;
  onDeleteImage: (id: number | string) => void;
  onMakePrimaryImage: (id: number | string) => void;
  onImageDragStart: (event: React.DragEvent, position: number) => void;
  onImageDragEnter: (event: React.DragEvent, position: number) => void;
  onImageDrop: (event: React.DragEvent) => void;
  onChangeFaq: (items: DetailFaqEntry[]) => void;
}

const fieldClassName =
  'admin-glass-input w-full';

const textAreaClassName = `${fieldClassName} min-h-[112px]`;

const ProductMainForm: React.FC<ProductMainFormProps> = ({
  formData,
  keyBenefitsText,
  skinTypesText,
  isGenerating,
  contentBlocks,
  imageList,
  faqItems,
  onChange,
  onGenerateDetails,
  onKeyBenefitsChange,
  onSkinTypesChange,
  onAddContentBlock,
  onUpdateContentBlock,
  onRemoveContentBlock,
  onContentImageSelected,
  onImageFilesSelected,
  onDeleteImage,
  onMakePrimaryImage,
  onImageDragStart,
  onImageDragEnter,
  onImageDrop,
  onChangeFaq,
}) => {
  return (
    <div className="space-y-5">
      <section id="product-editor-general" className="scroll-mt-32 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Thông tin cơ bản</p>
            <h3 className="mt-2 text-xl font-bold text-foreground">Tên, slug và mô tả ngắn</h3>

          </div>
          <button
            type="button"
            onClick={onGenerateDetails}
            disabled={isGenerating || !formData.name}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? <Spinner className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4" />}
            <span>{isGenerating ? 'AI đang điền dữ liệu' : 'Tạo nhanh bằng AI'}</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Tên sản phẩm</span>
            <input type="text" name="name" value={formData.name || ''} onChange={onChange} className={fieldClassName} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Slug URL</span>
            <input type="text" name="slug" value={formData.slug || ''} onChange={onChange} className={fieldClassName} required />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Mô tả ngắn</span>
          <textarea name="description" value={formData.description || ''} onChange={onChange} rows={4} className={`${textAreaClassName} min-h-[124px]`} required />
        </label>
      </section>

      <section id="product-editor-content" className="scroll-mt-32 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Nội dung sản phẩm</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Lợi ích, thành phần và mô tả dài</h3>

        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Lợi ích chính</span>
            <textarea value={keyBenefitsText} onChange={(event) => onKeyBenefitsChange(event.target.value)} rows={5} className={textAreaClassName} placeholder="Mỗi dòng là một lợi ích." />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Loại da phù hợp</span>
            <textarea value={skinTypesText} onChange={(event) => onSkinTypesChange(event.target.value)} rows={5} className={textAreaClassName} placeholder="Mỗi dòng là một nhóm da." />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Thành phần</span>
            <textarea name="ingredients" value={formData.ingredients || ''} onChange={onChange} rows={5} className={textAreaClassName} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Hướng dẫn sử dụng</span>
            <textarea name="usage_instructions" value={formData.usage_instructions || ''} onChange={onChange} rows={5} className={textAreaClassName} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Lưu ý / cảnh báo</span>
          <textarea name="precautions" value={formData.precautions || ''} onChange={onChange} rows={4} className={`${textAreaClassName} min-h-[104px]`} />
        </label>

        <div className="mt-6 rounded-[1.5rem] bg-background p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Mô tả dài dạng block</p>

            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddContentBlock('text')}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Thêm đoạn text
              </button>
              <button
                type="button"
                onClick={() => onAddContentBlock('image')}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Thêm ảnh nội dung
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {contentBlocks.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-card/25 backdrop-blur-xl px-4 py-6 text-sm text-muted-foreground">
                Chưa có block mô tả dài. Bắt đầu với một block text hoặc ảnh để xây nội dung sản phẩm.
              </div>
            ) : null}

            {contentBlocks.map((block, index) => (
              <div key={block.id} className="rounded-[1.3rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {index + 1}
                    </span>
                    {block.type === 'text' ? 'Text block' : 'Image block'}
                  </div>
                  <div className="relative group inline-flex">
                    <button
                      type="button"
                      onClick={() => onRemoveContentBlock(block.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:scale-110 hover:border-red-200 hover:text-destructive active:scale-95"
                      aria-label="Xóa block nội dung"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                      Xóa block
                    </span>
                  </div>
                </div>

                {block.type === 'text' ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'H1', value: '\n# ' },
                        { label: 'H2', value: '\n## ' },
                        { label: 'H3', value: '\n### ' },
                        { label: 'Bullet', value: '\n- ' },
                        { label: 'Link', value: '[Tên link](https://)' },
                        { label: 'Quote', value: '\n> ' },
                      ].map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => onUpdateContentBlock(block.id, { content: `${block.content || ''}${action.value}` })}
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={block.content || ''}
                      onChange={(event) => onUpdateContentBlock(block.id, { content: event.target.value })}
                      rows={9}
                      className={`${fieldClassName} min-h-[220px] font-mono text-sm`}
                      placeholder="Viết nội dung markdown cho block này."
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-[1.2rem] border border-border bg-muted/20">
                        {block.image_url ? (
                          <img src={block.image_url} alt="Preview block content" className="aspect-square h-full w-full object-cover" />
                        ) : (
                          <div className="flex aspect-square items-center justify-center px-4 text-center text-xs text-muted-foreground">Chưa có ảnh nội dung</div>
                        )}
                      </div>
                      <ImageDropzone
                        onFilesSelected={(files) => onContentImageSelected(block.id, files)}
                        className="min-h-[180px]"
                        label="Kéo ảnh nội dung vào đây hoặc"
                        buttonLabel="chọn ảnh"
                        helpText="Một block ảnh chỉ dùng một ảnh. Có thể thêm caption ở bên dưới."
                      />
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-foreground">Chú thích ảnh</span>
                      <input
                        type="text"
                        value={block.caption || ''}
                        onChange={(event) => onUpdateContentBlock(block.id, { caption: event.target.value })}
                        className={fieldClassName}
                        placeholder="Chú thích ngắn cho ảnh nội dung."
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MediaUploader
        id="product-editor-images"
        images={imageList}
        onFilesSelected={onImageFilesSelected}
        onDeleteImage={onDeleteImage}
        onMakePrimary={onMakePrimaryImage}
        onDragStart={onImageDragStart}
        onDragEnter={onImageDragEnter}
        onDrop={onImageDrop}
      />

      <FAQEditor id="product-editor-faq" value={faqItems} onChange={onChangeFaq} />
    </div>
  );
};

export default ProductMainForm;
