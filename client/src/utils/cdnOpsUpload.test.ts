import { describe, expect, it } from 'vitest';
import { resolveCdnOpsUploadUrl } from './cdnOpsUpload';

describe('resolveCdnOpsUploadUrl', () => {
  it('opens the event folder, not the parent ID folder', () => {
    expect(
      resolveCdnOpsUploadUrl(
        'https://dl.dir.freefiremobile.com/common/OB53/ID/100626_NUTSANGEROVNRLKIEI/overview.ff_extend',
      ),
    ).toBe(
      'https://cdnops.jingle.cn/upload/OB53/ID/100626_NUTSANGEROVNRLKIEI',
    );
  });
});
