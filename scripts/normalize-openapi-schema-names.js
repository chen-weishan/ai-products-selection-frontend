const fs = require('node:fs');
const path = require('node:path');

const specPath = path.resolve(__dirname, '..', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const schemas = spec.components?.schemas;

if (!schemas) {
  throw new Error('openapi.json 缺少 components.schemas');
}

const recalculationRef = schemas.RulesResponse?.properties?.recalculation;
const snapshot = schemas.Snapshot;
const hasRiskSnapshotCollision =
  recalculationRef?.$ref === '#/components/schemas/Snapshot' &&
  snapshot?.properties?.running &&
  snapshot?.properties?.progressPercent &&
  !schemas.PoolSnapshot;

if (hasRiskSnapshotCollision) {
  schemas.RiskRecalculationSnapshot = snapshot;
  recalculationRef.$ref = '#/components/schemas/RiskRecalculationSnapshot';

  schemas.PoolSnapshot = {
    type: 'object',
    properties: {
      pool: { type: 'string', enum: ['TRACK_A', 'TRACK_B', 'RETRY'] },
      share: { type: 'number', format: 'double' },
      limit: { type: 'integer', format: 'int32' },
      used: { type: 'integer', format: 'int32' },
      cacheHits: { type: 'integer', format: 'int32' },
      status: { type: 'string', enum: ['OK', 'WARNING', 'EXHAUSTED'] },
    },
  };
  schemas.Snapshot = {
    type: 'object',
    properties: {
      dailyQuota: { type: 'integer', format: 'int32' },
      resetAt: { type: 'string', format: 'date-time' },
      resetSource: { type: 'string' },
      pools: {
        type: 'array',
        items: { $ref: '#/components/schemas/PoolSnapshot' },
      },
    },
  };

  fs.writeFileSync(specPath, `${JSON.stringify(spec)}\n`);
  console.log('Resolved OpenAPI Snapshot collision: AI budget and risk recalculation now use distinct schemas.');
} else {
  console.log('No OpenAPI Snapshot collision detected.');
}
