import React, { useState, useCallback, useRef, useId } from 'react';
import { CameraIcon } from './icons';
import { useTranslation } from 'react-i18next';

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  helpText?: string;
  className?: string;
  accept?: string;
  selectedFileLabel?: string | null;
  buttonLabel?: string;
}

export const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  onFilesSelected,
  multiple = false,
  label,
  helpText,
  className = "",
  accept = "image/*",
  selectedFileLabel,
  buttonLabel,
}) => {
  const { t } = useTranslation();
  const inputId = useId();
  const displayLabel = label || t('upload.drag_drop', 'Kéo ảnh vào đây hoặc');
  const displayHelpText = helpText !== undefined ? helpText : t('upload.support_formats', 'Hỗ trợ JPG, PNG, WEBP');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayButtonLabel = buttonLabel || t('upload.click_to_select', 'nhấn để chọn tệp');

  const handleFileChange = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
  }, [onFilesSelected]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
    }
  }, [handleFileChange]);

  const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent label from triggering input again
    inputRef.current?.click();
  };

  return (
    <div className={`relative w-full h-full ${className}`} onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
      <input
        ref={inputRef}
        type="file"
        id={inputId}
        className="hidden"
        multiple={multiple}
        accept={accept}
        onChange={(e) => handleFileChange(e.target.files)}
      />
      <label
        htmlFor={inputId}
        className={`flex flex-col items-center justify-center w-full h-full rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
          }`}
      >
        <div className="text-center p-4 w-full">
          <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-camera.webp" alt="Upload" className="w-8 h-8 object-contain mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">
            {displayLabel}{' '}
            <button type="button" onClick={onButtonClick} className="font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-ring rounded">
              {displayButtonLabel}
            </button>
          </p>
          {displayHelpText && <p className="text-xs text-muted-foreground/80 mt-1">{displayHelpText}</p>}
          {selectedFileLabel && (
            <div className="mt-3 inline-flex max-w-full items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="truncate">{selectedFileLabel}</span>
            </div>
          )}
        </div>
      </label>
      {dragActive && <div className="absolute inset-0 w-full h-full" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
    </div>
  );
};
