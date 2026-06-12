import { describe, expect, it } from 'vitest';
import { parseToolFLine } from './toolFLogFormat.js';

describe('parseToolFLine', () => {
  it('parses structured upload and summary lines', () => {
    const uploaded = parseToolFLine(
      'TOOL_F_UPLOADED: Scythe | https://dl.dir.freefiremobile.com/common/OB53/ID/200626_YSTCHTIGRASE/event.jpg',
    );
    expect(uploaded?.kind).toBe('uploaded');
    expect(uploaded?.eventName).toBe('Scythe');
    expect(uploaded?.cdnUrl).toContain('event.jpg');

    const summary = parseToolFLine('TOOL_F_SUMMARY: uploaded=1 failed=2 skipped=3');
    expect(summary?.userMessage).toContain('uploaded: 1');
    expect(summary?.userMessage).toContain('failed: 2');
    expect(summary?.userMessage).toContain('skipped: 3');

    const subWeek = parseToolFLine('TOOL_F_SUB_WEEK: 10 - 16 Jun');
    expect(subWeek?.userMessage).toBe('Sub-week: 10 - 16 Jun');
  });
});
