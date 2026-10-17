import React, { useState, useRef } from 'react';
import { HiArrowUpTray, HiDocumentText, HiPhoto, HiXMark } from 'react-icons/hi2';

export default function FileUpload({
  label,
  helperText = 'PDF, PNG, JPG up to 5MB',
  accept = '.pdf,image/png,image/jpeg,image/jpg',
  maxSizeMB = 5,
  multiple = false,
  onChange,
  value,
  error,
  disabled = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalFiles, setInternalFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Sync with value if passed (e.g. File or File[] or existing url)
  const currentFiles = value
    ? Array.isArray(value)
      ? value
      : [value]
    : internalFiles;

  const validateAndHandleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const validFiles = [];
    const maxBytes = maxSizeMB * 1024 * 1024;

    for (const file of filesArray) {
      if (file.size > maxBytes) {
        alert(`File "${file.name}" exceeds the maximum size of ${maxSizeMB}MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const result = multiple ? [...currentFiles, ...validFiles] : [validFiles[0]];
      setInternalFiles(result);
      if (onChange) {
        onChange(multiple ? result : result[0]);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files) {
      validateAndHandleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      validateAndHandleFiles(e.target.files);
    }
  };

  const handleRemove = (index, e) => {
    e.stopPropagation();
    const updated = currentFiles.filter((_, i) => i !== index);
    setInternalFiles(updated);
    if (onChange) {
      onChange(multiple ? updated : updated[0] || null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
          isDragOver
            ? 'border-primary-500 bg-primary-50/50'
            : error
            ? 'border-red-300 bg-red-50/30'
            : 'border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-primary-600 flex items-center justify-center mb-2">
            <HiArrowUpTray className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            <span className="text-primary-600 hover:underline">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">{helperText}</p>
        </div>
      </div>

      {/* Selected File Previews */}
      {currentFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {currentFiles.map((file, idx) => {
            const isFileObj = file instanceof File;
            const fileName = isFileObj ? file.name : (typeof file === 'string' ? file.split('/').pop() : 'Attachment');
            const isImage = isFileObj
              ? file.type.startsWith('image/')
              : typeof file === 'string' && /\.(jpg|jpeg|png|webp|gif)$/i.test(file);
            const previewUrl = isFileObj && isImage ? URL.createObjectURL(file) : null;

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={fileName}
                      className="w-10 h-10 object-cover rounded-md border border-gray-200"
                    />
                  ) : isImage ? (
                    <div className="w-10 h-10 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <HiPhoto className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                      <HiDocumentText className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                    {isFileObj && (
                      <p className="text-xs text-gray-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(idx, e)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded-md transition"
                    title="Remove file"
                  >
                    <HiXMark className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
