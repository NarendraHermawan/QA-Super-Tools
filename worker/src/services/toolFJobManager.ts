import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import {
  appendLog,
  createJob,
  finishJob,
  getActiveJobId,
  setActiveJobId,
  type ToolFJobStatus,
} from '../db/toolFRepository.js';
import {
  parseSummaryCounts,
  parseToolFLine,
} from './toolFLogFormat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

let childProcess: ChildProcessWithoutNullStreams | null = null;
let currentJobId: string | null = null;

function pythonCommand(): string {
  if (config.pythonCommand) return config.pythonCommand;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function scriptPath(): string {
  return path.resolve(projectRoot, 'scripts', 'cdn_bot.py');
}

function buildPythonEnv(scope: { tabName: string; subWeekLabel: string }): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CDN_API_TOKEN: config.cdnApiToken,
    NOTION_API_TOKEN: config.notionApiToken,
    SEATALK_WEBHOOK_URL: config.seatalkWebhookUrl,
    GOOGLE_SERVICE_ACCOUNT_KEY: config.serviceAccountKeyPath,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
    DOWNLOAD_BASE: config.toolFDownloadBase,
    SHEET_TITLE: config.sheetTitle,
    TOOL_F_SHEET_TAB: scope.tabName,
    TOOL_F_SUB_WEEK: scope.subWeekLabel,
  };
}

function parseLogLine(line: string): {
  succeeded: number;
  failed: number;
  skipped: number;
} {
  const counts = { succeeded: 0, failed: 0, skipped: 0 };
  const parsed = parseToolFLine(line);
  if (parsed) {
    if (parsed.kind === 'uploaded') counts.succeeded = 1;
    else if (parsed.kind === 'failed') counts.failed = 1;
    else if (parsed.kind === 'skipped') counts.skipped = 1;
    else if (parsed.kind === 'summary') {
      const summary = parseSummaryCounts(parsed.detail);
      if (summary) return summary;
    }
    return counts;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('✅')) counts.succeeded = 1;
  else if (trimmed.startsWith('❌')) counts.failed = 1;
  else if (/^Skipping .+: already uploaded/i.test(trimmed)) counts.skipped = 1;

  return counts;
}

export function isToolFRunning(): boolean {
  return childProcess !== null && !childProcess.killed;
}

export async function startToolFJob(
  onEvent: (payload: Record<string, unknown>) => void,
  scope: { tabName: string; subWeekLabel: string },
): Promise<string> {
  if (isToolFRunning() || getActiveJobId()) {
    throw new Error('A Tool F job is already running');
  }
  if (!config.cdnApiToken) {
    throw new Error('CDN_API_TOKEN is not configured');
  }

  const job = await createJob();
  currentJobId = job.id;
  onEvent({ type: 'jobId', jobId: job.id });

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const py = spawn(pythonCommand(), [scriptPath()], {
    env: buildPythonEnv(scope),
    cwd: projectRoot,
  });
  childProcess = py;

  const handleLine = async (line: string, type: 'log' | 'error') => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parsed = parseToolFLine(trimmed);

    if (parsed) {
      onEvent({
        type: type === 'error' ? 'error' : 'log',
        message: parsed.userMessage,
        kind: parsed.kind,
      });
    } else if (type === 'error') {
      onEvent({ type: 'error', message: trimmed });
    }

    if (!currentJobId) return;

    if (!parsed) return;

    const counts = parseLogLine(trimmed);
    if (parsed.kind !== 'summary') {
      succeeded += counts.succeeded;
      failed += counts.failed;
      skipped += counts.skipped;
    } else {
      const summary = parseSummaryCounts(parsed.detail);
      if (summary) {
        succeeded = summary.uploaded;
        failed = summary.failed;
        skipped = summary.skipped;
      }
    }

    let status: 'success' | 'failed' | 'skipped' | 'info' = 'info';
    if (parsed.kind === 'uploaded') status = 'success';
    else if (parsed.kind === 'failed') status = 'failed';
    else if (parsed.kind === 'skipped') status = 'skipped';

    if (parsed.kind === 'tab' || parsed.kind === 'summary') {
      await appendLog(currentJobId, {
        status: 'info',
        message: parsed.userMessage,
        rowLabel: parsed.kind === 'tab' ? parsed.eventName : null,
      });
      return;
    }

    if (parsed.kind === 'uploaded' || parsed.kind === 'failed' || parsed.kind === 'skipped') {
      await appendLog(currentJobId, {
        status,
        message: parsed.userMessage,
        rowLabel: parsed.eventName || null,
        cdnUrl: parsed.cdnUrl,
        ffUrl: parsed.cdnUrl,
      });
    }
  };

  let stdoutBuffer = '';
  py.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      void handleLine(line, 'log');
    }
  });

  let stderrBuffer = '';
  py.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() ?? '';
    for (const line of lines) {
      void handleLine(line, 'error');
    }
  });

  return new Promise((resolve, reject) => {
    py.on('error', (err) => {
      childProcess = null;
      void finishJob(job.id, 'failed', { succeeded, failed, skipped });
      currentJobId = null;
      reject(err);
    });

    py.on('close', (code) => {
      if (stdoutBuffer.trim()) void handleLine(stdoutBuffer, 'log');
      if (stderrBuffer.trim()) void handleLine(stderrBuffer, 'error');

      const wasCancelled = py.signalCode === 'SIGTERM';
      let status: ToolFJobStatus = 'completed';
      if (wasCancelled) status = 'cancelled';
      else if (code !== 0) status = 'failed';

      void finishJob(job.id, status, { succeeded, failed, skipped }).then(() => {
        onEvent({ type: 'complete', exitCode: code, status });
        childProcess = null;
        currentJobId = null;
        setActiveJobId(null);
        resolve(job.id);
      });
    });
  });
}

export async function cancelToolFJob(): Promise<boolean> {
  if (!childProcess || childProcess.killed) return false;
  childProcess.kill('SIGTERM');
  return true;
}
