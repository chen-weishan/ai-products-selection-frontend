import { buildCron, describeCron, parseCron, sameSchedule } from './cron-schedule';

describe('cron-schedule', () => {
  it('parses the default schedules into friendly forms', () => {
    expect(parseCron('0 0 7 * * MON')).toMatchObject({ frequency: 'WEEKLY', time: '07:00', weekdays: [1] });
    expect(parseCron('0 0 7 * * TUE-SUN')).toMatchObject({ frequency: 'WEEKLY', weekdays: [2, 3, 4, 5, 6, 7] });
    expect(parseCron('0 30 6 * * *')).toMatchObject({ frequency: 'DAILY', time: '06:30' });
    expect(parseCron('0 0 9 1 1,4,7,10 *')).toMatchObject({ frequency: 'QUARTERLY', dayOfMonth: 1, time: '09:00' });
    expect(parseCron('0 15 3 5 * *')).toMatchObject({ frequency: 'MONTHLY', dayOfMonth: 5, time: '03:15' });
  });

  it('falls back to ADVANCED for expressions the form cannot represent', () => {
    expect(parseCron('0 0 8,9 1 1,4,7,10 *').frequency).toBe('ADVANCED');
    expect(parseCron('*/30 * * * * *').frequency).toBe('ADVANCED');
    expect(parseCron('not a cron').frequency).toBe('ADVANCED');
  });

  it('round-trips weekly ranges without changing the written form', () => {
    expect(buildCron(parseCron('0 0 7 * * TUE-SUN'))).toBe('0 0 7 * * TUE-SUN');
    expect(buildCron({ frequency: 'WEEKLY', time: '08:05', weekdays: [5, 1, 3], dayOfMonth: 1, cron: '' }))
      .toBe('0 5 8 * * MON,WED,FRI');
    expect(sameSchedule('0 0 7 * * TUE,WED,THU,FRI,SAT,SUN', '0 0 7 * * TUE-SUN')).toBe(true);
  });

  it('describes schedules in plain Chinese', () => {
    expect(describeCron('0 0 7 * * MON')).toBe('每週一 07:00');
    expect(describeCron('0 0 7 * * TUE-SUN')).toBe('每週二至週日 07:00');
    expect(describeCron('0 0 6 * * *')).toBe('每天 06:00');
    expect(describeCron('0 0 8,9 1 1,4,7,10 *')).toBe('每季首月（1、4、7、10 月）1 日 08:00、09:00');
    expect(describeCron('*/30 * * * * *')).toBeNull();
  });
});
