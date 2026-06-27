import { useState, useEffect, useRef } from 'react';
import { warehouseService } from '../services/warehouseService';
import { useErrorHandler } from '../hooks/useErrorHandler';
import './FileUpload.css';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
const DOC_MIMES = [
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ACCEPT_STRING = [
  ...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES,
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
].join(',');

const classifyFile = (file) => {
  const mime = file.type || '';
  if (IMAGE_MIMES.includes(mime) || mime.startsWith('image/')) return 'images';
  if (VIDEO_MIMES.includes(mime) || mime.startsWith('video/')) return 'videos';
  if (DOC_MIMES.includes(mime)) return 'docs';

  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'images';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'videos';
  if (DOC_EXTENSIONS.includes(ext)) return 'docs';

  return null;
};

const resolveMime = (file) => {
  let contentType = file.type;
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = file.name.toLowerCase().split('.').pop();
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    contentType = map[ext] || 'application/octet-stream';
  }
  return contentType;
};

const getFileName = (url) => {
  try { return new URL(url).pathname.split('/').pop() || url; }
  catch { return url.split('/').pop() || url; }
};

const EMPTY_MEDIA = { images: [], videos: [], docs: [] };

/**
 * FileUpload — images, videos, documents (native input + custom CSS).
 */
const normalizeMedia = (v) =>
  v && typeof v === 'object'
    ? { images: v.images || [], videos: v.videos || [], docs: v.docs || [] }
    : EMPTY_MEDIA;

const FileUpload = ({ value, onChange, onUploadingChange, uploadedBy, disabled = false, maxSize = 50 }) => {
  const [activeUploads, setActiveUploads] = useState(new Map());
  const inputRef = useRef(null);
  const { handleUploadError, showSuccessMessage, showErrorMessage } = useErrorHandler();

  const media = normalizeMedia(value);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const uploading = activeUploads.size > 0;
  useEffect(() => {
    if (onUploadingChange) onUploadingChange(uploading);
  }, [uploading, onUploadingChange]);

  const notify = (next) => {
    if (onChange) onChange(next);
  };

  const updateUpload = (id, patch) => {
    setActiveUploads(prev => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id), ...patch });
      return next;
    });
  };

  const removeUpload = (id) => {
    setActiveUploads(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const uploadFile = async (file, uploadId) => {
    const contentType = resolveMime(file);
    const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(contentType, uploadedBy);

    updateUpload(uploadId, { progress: 10 });

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 120000;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          updateUpload(uploadId, { progress: Math.round(10 + (e.loaded / e.total) * 85) });
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) { updateUpload(uploadId, { progress: 100 }); resolve(); }
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });

    return imageUrl;
  };

  const processFile = (file) => {
    const category = classifyFile(file);
    if (!category) {
      showErrorMessage({ type: 'validation', message: `"${file.name}": Unsupported file type. Allowed: images, videos, PDFs, and Office documents.` });
      return;
    }

    if (file.size / 1024 / 1024 >= maxSize) {
      showErrorMessage({ type: 'validation', message: `"${file.name}": File must be smaller than ${maxSize}MB!` });
      return;
    }

    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActiveUploads(prev => {
      const next = new Map(prev);
      next.set(uploadId, { name: file.name, progress: 0 });
      return next;
    });

    uploadFile(file, uploadId)
      .then((url) => {
        const current = normalizeMedia(valueRef.current);
        const next = { ...current, [category]: [...current[category], url] };
        // Update the ref synchronously so concurrent uploads completing in the
        // same burst accumulate instead of clobbering each other. Relying on the
        // useEffect to refresh valueRef lags behind a burst of onChange calls,
        // which dropped files when several uploads finished together (Android).
        valueRef.current = next;
        if (onChange) onChange(next);
        showSuccessMessage('upload');
      })
      .catch((err) => {
        console.error('Upload failed:', err);
        handleUploadError(err, file.name);
      })
      .finally(() => {
        removeUpload(uploadId);
      });
  };

  const onInputChange = (e) => {
    const { files } = e.target;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i += 1) {
      processFile(files[i]);
    }
    e.target.value = '';
  };

  const handleRemove = (category, urlToRemove) => {
    const next = { ...media, [category]: media[category].filter(u => u !== urlToRemove) };
    notify(next);
  };

  const totalCount = media.images.length + media.videos.length + media.docs.length;

  return (
    <div className="file-upload">
      {media.images.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span className="file-upload__heading">Images ({media.images.length})</span>
          <div className="file-upload__grid file-upload__grid--images">
            {media.images.map((url, i) => (
              <div key={url + i} className="file-upload__card">
                <div className="file-upload__card-body">
                  <img className="file-upload__thumb" src={url} alt="" loading="lazy" />
                </div>
                <div className="file-upload__actions">
                  <button type="button" onClick={() => window.open(url, '_blank')}>View</button>
                  <button type="button" disabled={uploading} onClick={() => handleRemove('images', url)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {media.videos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span className="file-upload__heading">Videos ({media.videos.length})</span>
          <div className="file-upload__grid">
            {media.videos.map((url, i) => (
              <div key={url + i} className="file-upload__card">
                <div className="file-upload__card-body">
                  <div className="file-upload__row">
                    <span aria-hidden style={{ fontSize: 18 }}>▶</span>
                    <span className="file-upload__name">{getFileName(url)}</span>
                  </div>
                </div>
                <div className="file-upload__actions">
                  <button type="button" onClick={() => window.open(url, '_blank')}>Open</button>
                  <button type="button" disabled={uploading} onClick={() => handleRemove('videos', url)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {media.docs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span className="file-upload__heading">Documents ({media.docs.length})</span>
          <div className="file-upload__grid">
            {media.docs.map((url, i) => (
              <div key={url + i} className="file-upload__card">
                <div className="file-upload__card-body">
                  <div className="file-upload__row">
                    <span aria-hidden className="file-upload__doc-icon">Doc</span>
                    <span className="file-upload__name">{getFileName(url)}</span>
                  </div>
                </div>
                <div className="file-upload__actions">
                  <button type="button" onClick={() => window.open(url, '_blank')}>Open</button>
                  <button type="button" disabled={uploading} onClick={() => handleRemove('docs', url)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeUploads.size > 0 && (
        <div style={{ marginBottom: 12 }}>
          {[...activeUploads.entries()].map(([id, { name, progress }]) => (
            <div key={id} className="file-upload__progress">
              <span className="file-upload__progress-label">{name}</span>
              <div className="file-upload__progress-track">
                <div className="file-upload__progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="file-upload__input"
        accept={ACCEPT_STRING}
        multiple
        disabled={disabled}
        onChange={onInputChange}
      />
      <button
        type="button"
        className="file-upload__trigger"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        + {totalCount === 0 && !uploading ? 'Add Files' : 'Add More Files'}
      </button>

      <p className="file-upload__hint">
        Max {maxSize}MB per file. Supports images, videos, and documents (PDF, Word, Excel).
      </p>
    </div>
  );
};

export default FileUpload;
