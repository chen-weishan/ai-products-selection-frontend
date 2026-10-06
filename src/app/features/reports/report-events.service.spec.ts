import { parseReportEventFrame } from './report-events.service';

describe('ReportEventsService event parser', () => {
  it('recognizes a connected event', () => {
    expect(parseReportEventFrame('event: connected\ndata: {"connectedAt":"now"}'))
      .toEqual({ type: 'connected' });
  });

  it('parses a completed report status event', () => {
    const event = parseReportEventFrame(`event: report-status
data: {"id":7,"reportType":"WEEKLY_PICK","format":"PDF","params":{"period":"2026W41"},"status":"SUCCEEDED","fileName":"weekly.pdf","fileSize":1200,"rowCount":40,"requestedAt":"2026-10-06T00:00:00Z","finishedAt":"2026-10-06T00:00:05Z","downloadable":true}`);

    expect(event).toEqual(expect.objectContaining({
      type: 'status',
      job: expect.objectContaining({ id: 7, status: 'SUCCEEDED', downloadable: true }),
    }));
  });

  it('ignores heartbeat and malformed report events', () => {
    expect(parseReportEventFrame('event: heartbeat\ndata: {}')).toBeNull();
    expect(parseReportEventFrame('event: report-status\ndata: {"id":"bad"}')).toBeNull();
  });
});
