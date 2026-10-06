const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const openApiPath = path.resolve(__dirname, '../openapi.json');

// 1. Get HEAD openapi.json (the stable working base)
const headDoc = JSON.parse(execSync('git show HEAD:openapi.json', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));

// 2. Read the current backend spec (currently in openapi.json or from backend endpoint)
const currentDoc = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));

// 3. Extract heat-tags paths from currentDoc
const heatTagPaths = ['/heat-tags', '/heat-tags/{id}', '/heat-tags/resolve-platform'];
for (const p of heatTagPaths) {
  if (currentDoc.paths[p]) {
    headDoc.paths[p] = currentDoc.paths[p];
    console.log(`Synced path: ${p}`);
  }
}

// 4. Find all schemas used by heat-tags
const schemasToCopy = new Set([
  'ManualHeatTagCreateRequest',
  'ManualHeatTagUpdateRequest',
  'ManualHeatTagResponse',
  'ApiResponseManualHeatTagResponse',
  'ApiResponseListManualHeatTagResponse',
  'ResolvePlatformRequest',
  'ApiResponseResolvePlatformResponse',
  'ResolvePlatformResponse'
]);

for (const s of schemasToCopy) {
  if (currentDoc.components?.schemas?.[s]) {
    if (!headDoc.components.schemas) headDoc.components.schemas = {};
    headDoc.components.schemas[s] = currentDoc.components.schemas[s];
    console.log(`Synced schema: ${s}`);
  }
}

// 5. Strip uniqueItems from all schemas to ensure standard Array generation everywhere
for (const [schemaName, schema] of Object.entries(headDoc.components?.schemas || {})) {
  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      if (prop.uniqueItems !== undefined) {
        delete prop.uniqueItems;
      }
    }
  }
}

fs.writeFileSync(openApiPath, JSON.stringify(headDoc, null, 2) + '\n', 'utf8');
console.log('Successfully synced heat-tags into openapi.json cleanly.');
