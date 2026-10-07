import { Injectable, inject } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { ReportJob, ReportStatus, ReportType } from './report.models';

export type ReportStreamEvent =
  | { type: 'connected' }
  | { type: 'status'; job: ReportJob };

const REPORT_TYPES = new Set<ReportType>([
  'WEEKLY_PICK',
  'SCORE_DETAIL',
  'ACCURACY',
  'SOURCING_QUEUE',
  'CALIBRATION',
]);
const REPORT_STATUSES = new Set<ReportStatus>([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL',
  'CANCELLED',
]);

@Injectable({ providedIn: 'root' })
export class ReportEventsService {
  private readonly auth = inject(AuthService);
  private readonly eventsUrl = `${environment.apiBaseUrl}/reports/events`;

  watch(): Observable<ReportStreamEvent> {
    return new Observable(subscriber => {
      const controller = new AbortController();
      void this.connect(subscriber, controller.signal);
      return () => controller.abort();
    });
  }

  private async connect(
    subscriber: Subscriber<ReportStreamEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      const token = this.auth.getAccessToken();
      if (!token) {
        subscriber.error(new Error('登入憑證不存在，無法接收報表即時通知'));
        return;
      }
      try {
        const response = await fetch(this.eventsUrl, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal,
        });
        if (response.status === 401 || response.status === 403) {
          subscriber.error(new Error('登入憑證已失效，無法接收報表即時通知'));
          return;
        }
        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }
        await this.consume(response.body, subscriber, signal);
      } catch (error) {
        if (signal.aborted) return;
        // Transient network and proxy failures reconnect below.
      }
      await this.waitForReconnect(signal);
    }
  }

  private async consume(
    body: ReadableStream<Uint8Array>,
    subscriber: Subscriber<ReportStreamEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = parseReportEventFrame(frame);
          if (event) subscriber.next(event);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private waitForReconnect(signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const onAbort = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      const timeout = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 3_000);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export function parseReportEventFrame(frame: string): ReportStreamEvent | null {
  let eventName = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (eventName === 'connected') return { type: 'connected' };
  if (eventName !== 'report-status' || data.length === 0) return null;
  try {
    const job = toReportJob(JSON.parse(data.join('\n')));
    return job ? { type: 'status', job } : null;
  } catch {
    return null;
  }
}

function toReportJob(value: unknown): ReportJob | null {
  if (!isRecord(value)) return null;
  if (
    typeof value['id'] !== 'number' ||
    typeof value['reportType'] !== 'string' ||
    !REPORT_TYPES.has(value['reportType'] as ReportType) ||
    (value['format'] !== 'PDF' && value['format'] !== 'XLSX') ||
    typeof value['status'] !== 'string' ||
    !REPORT_STATUSES.has(value['status'] as ReportStatus) ||
    typeof value['requestedAt'] !== 'string' ||
    typeof value['downloadable'] !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value['id'],
    reportType: value['reportType'] as ReportType,
    format: value['format'],
    params: isRecord(value['params']) ? value['params'] as Record<string, string | number> : {},
    status: value['status'] as ReportStatus,
    fileName: typeof value['fileName'] === 'string' ? value['fileName'] : null,
    fileSize: typeof value['fileSize'] === 'number' ? value['fileSize'] : null,
    rowCount: typeof value['rowCount'] === 'number' ? value['rowCount'] : null,
    requestedAt: value['requestedAt'],
    finishedAt: typeof value['finishedAt'] === 'string' ? value['finishedAt'] : null,
    downloadable: value['downloadable'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
