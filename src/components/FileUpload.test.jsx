import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/warehouseService', () => ({
  warehouseService: {
    getPresignedUrl: vi.fn(),
  },
}));

vi.mock('../utils/errorHandler', () => ({
  handleUploadError: vi.fn(),
  showSuccessMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showErrorNotification: vi.fn(),
  handleOperationError: vi.fn(),
  clearErrors: vi.fn(),
  parseError: vi.fn(),
  ERROR_TYPES: {},
}));

import FileUpload from './FileUpload';
import { warehouseService } from '../services/warehouseService';
import { showErrorMessage, showSuccessMessage } from '../utils/errorHandler';

class FakeXHRUpload {
  constructor() { this.listeners = {}; }
  addEventListener(name, cb) { this.listeners[name] = cb; }
  fire(name, e = {}) { this.listeners[name]?.(e); }
}

class FakeXHR {
  constructor() {
    this.upload = new FakeXHRUpload();
    this.listeners = {};
    this.headers = {};
    this.status = 200;
    FakeXHR.last = this;
    FakeXHR.instances.push(this);
  }
  addEventListener(name, cb) { this.listeners[name] = cb; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  send(body) { this.body = body; }
  fire(name, e = {}) { this.listeners[name]?.(e); }
}
FakeXHR.instances = [];

const makeFile = (name, type, sizeBytes = 1024) => {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
};

beforeEach(() => {
  FakeXHR.instances = [];
  FakeXHR.last = null;
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  warehouseService.getPresignedUrl.mockResolvedValue({
    uploadUrl: 'https://r2/u',
    imageUrl: 'https://r2/i',
  });
});

const selectFiles = async (files) => {
  const input = document.querySelector('input[type="file"]');
  await act(async () => {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('FileUpload', () => {
  it('FU-1: renders the Add Files trigger and hint when empty', () => {
    render(<FileUpload value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /add files/i })).toBeInTheDocument();
    expect(screen.getByText(/Max 50MB per file/)).toBeInTheDocument();
  });

  it('FU-4: rejects unsupported file types with a validation toast and no upload', async () => {
    render(<FileUpload value={null} onChange={vi.fn()} />);
    const file = makeFile('binary.xyz', '', 1024);

    await selectFiles([file]);

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'validation' })
    );
    expect(warehouseService.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('FU-5: rejects files at or above maxSize MB with a validation toast and no upload', async () => {
    render(<FileUpload value={null} onChange={vi.fn()} maxSize={1} />);
    const oversized = makeFile('huge.jpg', 'image/jpeg', 1024 * 1024 * 2);

    await selectFiles([oversized]);

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('1MB') })
    );
    expect(warehouseService.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('FU-2 + FU-7: uploads an image via presigned URL and calls onChange with the imageUrl in images', async () => {
    const onChange = vi.fn();
    render(<FileUpload value={null} onChange={onChange} uploadedBy="VBHIWH" />);
    const file = makeFile('pic.jpg', 'image/jpeg', 2048);

    await selectFiles([file]);

    await waitFor(() => {
      expect(warehouseService.getPresignedUrl).toHaveBeenCalledWith(
        'image/jpeg',
        'VBHIWH'
      );
    });
    await waitFor(() => expect(FakeXHR.last).toBeTruthy());

    expect(FakeXHR.last.method).toBe('PUT');
    expect(FakeXHR.last.url).toBe('https://r2/u');
    expect(FakeXHR.last.headers['Content-Type']).toBe('image/jpeg');

    // Simulate progress + completion
    act(() => {
      FakeXHR.last.upload.fire('progress', { lengthComputable: true, loaded: 1, total: 2 });
      FakeXHR.last.status = 200;
      FakeXHR.last.fire('load');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const payload = onChange.mock.calls.at(-1)[0];
    expect(payload.images).toContain('https://r2/i');
    expect(showSuccessMessage).toHaveBeenCalledWith('upload');
  });

  it('FU-3: classifies by extension when MIME is missing (e.g. clip.mov → videos)', async () => {
    const onChange = vi.fn();
    warehouseService.getPresignedUrl.mockResolvedValue({
      uploadUrl: 'https://r2/u',
      imageUrl: 'https://r2/vid.mov',
    });
    render(<FileUpload value={null} onChange={onChange} uploadedBy="" />);
    const file = makeFile('clip.mov', '', 2048);

    await selectFiles([file]);

    await waitFor(() => {
      // resolveMime maps .mov to video/quicktime when MIME is missing
      expect(warehouseService.getPresignedUrl).toHaveBeenCalledWith(
        'video/quicktime',
        ''
      );
    });
    await waitFor(() => expect(FakeXHR.last).toBeTruthy());

    act(() => {
      FakeXHR.last.status = 200;
      FakeXHR.last.fire('load');
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const payload = onChange.mock.calls.at(-1)[0];
    expect(payload.videos).toContain('https://r2/vid.mov');
  });

  it('FU-9: onUploadingChange fires true at start and false at end', async () => {
    const onUploadingChange = vi.fn();
    render(
      <FileUpload
        value={null}
        onChange={vi.fn()}
        onUploadingChange={onUploadingChange}
      />
    );
    const file = makeFile('pic.jpg', 'image/jpeg', 2048);

    await selectFiles([file]);
    await waitFor(() => expect(FakeXHR.last).toBeTruthy());

    expect(onUploadingChange).toHaveBeenCalledWith(true);

    act(() => {
      FakeXHR.last.status = 200;
      FakeXHR.last.fire('load');
    });

    await waitFor(() => {
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('renders existing media and supports removal', async () => {
    const onChange = vi.fn();
    const value = {
      images: ['https://r2/a.jpg'],
      videos: [],
      docs: ['https://r2/doc.pdf'],
    };
    render(<FileUpload value={value} onChange={onChange} />);

    expect(screen.getByText(/Images \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Documents \(1\)/)).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    const user = userEvent.setup();
    await user.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)[0];
    expect(next.images).toHaveLength(0);
    expect(next.docs).toEqual(['https://r2/doc.pdf']);
  });

  it('FU-10: caps files in flight at 4 so a large selection cannot exhaust the API', async () => {
    render(<FileUpload value={null} onChange={vi.fn()} uploadedBy="VBHIWH" />);
    const files = Array.from({ length: 12 }, (_, i) => makeFile(`p${i}.jpg`, 'image/jpeg', 1024));

    await selectFiles(files);

    // Every accepted file is listed immediately, the waiting ones marked as such.
    await waitFor(() => expect(screen.getAllByText(/waiting$/)).toHaveLength(8));

    // Only the first wave has asked for a presigned URL.
    await waitFor(() => expect(warehouseService.getPresignedUrl).toHaveBeenCalledTimes(4));
    expect(FakeXHR.instances).toHaveLength(4);

    // Completing one upload admits exactly one more.
    act(() => {
      FakeXHR.instances[0].status = 200;
      FakeXHR.instances[0].fire('load');
    });
    await waitFor(() => expect(warehouseService.getPresignedUrl).toHaveBeenCalledTimes(5));
    expect(FakeXHR.instances).toHaveLength(5);
  });

  it('FU-11: a 30-image submission uploads all 30 and keeps every url', async () => {
    const onChange = vi.fn();
    let n = 0;
    warehouseService.getPresignedUrl.mockImplementation(async () => {
      n += 1;
      return { uploadUrl: `https://r2/u${n}`, imageUrl: `https://r2/i${n}` };
    });

    const Harness = () => {
      const [media, setMedia] = React.useState(null);
      onChange.mockImplementation(setMedia);
      return <FileUpload value={media} onChange={onChange} uploadedBy="VBHIWH" />;
    };
    render(<Harness />);

    const files = Array.from({ length: 30 }, (_, i) => makeFile(`p${i}.jpg`, 'image/jpeg', 1024));
    await selectFiles(files);

    // Finish uploads as they are admitted until the queue is empty.
    let completed = 0;
    while (completed < 30) {
      await waitFor(() => expect(FakeXHR.instances.length).toBeGreaterThan(completed));
      const xhr = FakeXHR.instances[completed];
      await act(async () => {
        xhr.status = 200;
        xhr.fire('load');
      });
      completed += 1;
    }

    await waitFor(() => expect(screen.getByText(/Images \(30\)/)).toBeInTheDocument());
    const finalMedia = onChange.mock.calls.at(-1)[0];
    expect(new Set(finalMedia.images).size).toBe(30);
  });
});
