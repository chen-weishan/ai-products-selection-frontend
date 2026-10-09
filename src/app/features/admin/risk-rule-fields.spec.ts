import { RULE_FIELDS, fieldError, fieldsFor, toDisplay, toStored } from './risk-rule-fields';

describe('risk-rule-fields', () => {
  const field = (code: string, key: string) => RULE_FIELDS[code].find((item) => item.key === key)!;

  it('shows ratios as percentages and stores them back as ratios', () => {
    const negativeRate = field('REVIEW_RISK', 'negativeRateThreshold');
    expect(toDisplay(negativeRate, 0.15)).toBe(15);
    expect(toStored(negativeRate, 15)).toBe(0.15);
  });

  it('shows the heat crash slope as a positive drop percentage', () => {
    const slope = field('HEAT_CRASH', 'slope7dThreshold');
    expect(toDisplay(slope, -0.4)).toBe(40);
    expect(toStored(slope, 40)).toBe(-0.4);
    expect(fieldError(slope, 0)).not.toBeNull();
    expect(fieldError(slope, 100)).toBeNull();
  });

  it('validates integer and range constraints like the backend', () => {
    const minSample = field('REVIEW_RISK', 'minSampleSize');
    expect(fieldError(minSample, 0)).toContain('介於');
    expect(fieldError(minSample, 2.5)).toContain('整數');
    expect(fieldError(minSample, null)).toContain('請填寫');
    expect(fieldError(minSample, 20)).toBeNull();
  });

  it('keeps unknown numeric keys editable and skips non-numeric ones', () => {
    const fields = fieldsFor('LOGISTICS_RISK', {
      conditions: ['FROZEN'],
      fragilePoints: 3,
      newPoints: 2,
    });
    expect(fields.map((item) => item.key)).toEqual(['fragilePoints', 'newPoints']);
  });
});
