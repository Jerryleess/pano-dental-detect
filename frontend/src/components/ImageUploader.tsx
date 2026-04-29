import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";

interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

/**
 * ImageUploader — 拖曳 / 點選上傳 X 光圖片元件
 */
export default function ImageUploader({
  onFileSelected,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    (file?: File | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onClick = () => inputRef.current?.click();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  return (
    <div
      className={`uploader-zone ${isDragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={disabled ? undefined : onClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        hidden
      />

      {preview ? (
        <img src={preview} alt="Preview" className="uploader-preview" />
      ) : (
        <div className="uploader-placeholder">
          <span className="uploader-icon">🦷</span>
          <p>拖曳或點擊此處上傳全口 X 光片</p>
          <p className="uploader-hint">支援 JPG / PNG 格式</p>
        </div>
      )}
    </div>
  );
}
