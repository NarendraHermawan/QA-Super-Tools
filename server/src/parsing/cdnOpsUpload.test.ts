import { describe, expect, it } from 'vitest';
import {
  cdnOpsUploadUrlForPath,
  parseCdnOpsPathCandidates,
  resolveCdnOpsUploadUrlSync,
} from './cdnOpsUpload.js';

const CDN_BASE = 'https://dl.dir.freefiremobile.com/common/';

describe('cdnOpsUpload', () => {
  it('parses event and parent folder paths from full CDN URL', () => {
    const candidates = parseCdnOpsPathCandidates(
      'https://dl.dir.freefiremobile.com/common/OB53/ID/110605_penghapusaneven/overview.ff_extend',
      CDN_BASE,
    );
    expect(candidates).toEqual({
      eventFolderPath: 'OB53/ID/110605_penghapusaneven',
      parentFolderPath: 'OB53/ID',
    });
    expect(cdnOpsUploadUrlForPath(candidates!.eventFolderPath)).toBe(
      'https://cdnops.jingle.cn/upload/OB53/ID/110605_penghapusaneven',
    );
  });

  it('parses relative CDN paths with base URL', () => {
    const candidates = parseCdnOpsPathCandidates(
      'OB53/ID/100626_foo/overview1.ff_extend',
      CDN_BASE,
    );
    expect(candidates?.eventFolderPath).toBe('OB53/ID/100626_foo');
    expect(candidates?.parentFolderPath).toBe('OB53/ID');
  });

  it('builds sync upload URL to event folder', () => {
    expect(
      resolveCdnOpsUploadUrlSync(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/110605_penghapusaneven/overview.ff_extend',
        CDN_BASE,
      ),
    ).toBe('https://cdnops.jingle.cn/upload/OB53/ID/110605_penghapusaneven');
  });
});
