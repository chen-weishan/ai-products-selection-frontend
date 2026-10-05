const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const openApiPath = path.resolve(__dirname, '../openapi.json');

http.get('http://localhost:8080/api/v1/v3/api-docs', (res) => {
  let rawData = '';
  res.on('data', chunk => rawData += chunk);
  res.on('end', () => {
    try {
      const backendDoc = JSON.parse(rawData);
      const currentDoc = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));

      // 1. Sync heat-sources paths
      const heatSourcePaths = [
        '/heat-sources',
        '/heat-sources/{id}',
        '/heat-sources/excluded',
        '/heat-sources/{id}/test'
      ];

      for (const p of heatSourcePaths) {
        if (backendDoc.paths[p]) {
          currentDoc.paths[p] = backendDoc.paths[p];
          console.log(`Synced path: ${p}`);
        } else {
          console.warn(`Warning: Path ${p} not found in backend api-docs!`);
        }
      }

      // 2. Sync schemas needed for heat-sources
      const schemasToCopy = [
        'ApiResponseListHeatSourceDetailResponse',
        'HeatSourceDetailResponse',
        'ApiResponseHeatSourceDetailResponse',
        'HeatSourceUpdateRequest',
        'ApiResponseListExcludedHeatSourceResponse',
        'ExcludedHeatSourceResponse',
        'ApiResponseHeatSourceTestResponse',
        'HeatSourceTestResponse'
      ];

      if (!currentDoc.components) currentDoc.components = {};
      if (!currentDoc.components.schemas) currentDoc.components.schemas = {};

      for (const s of schemasToCopy) {
        if (backendDoc.components?.schemas?.[s]) {
          currentDoc.components.schemas[s] = backendDoc.components.schemas[s];
          console.log(`Synced schema: ${s}`);
        } else {
          console.warn(`Warning: Schema ${s} not found in backend api-docs!`);
        }
      }

      // 3. Strip uniqueItems from all schemas to ensure standard Array generation everywhere
      for (const [schemaName, schema] of Object.entries(currentDoc.components.schemas || {})) {
        if (schema.properties) {
          for (const [propName, prop] of Object.entries(schema.properties)) {
            if (prop.uniqueItems !== undefined) {
              delete prop.uniqueItems;
            }
          }
        }
      }

      fs.writeFileSync(openApiPath, JSON.stringify(currentDoc, null, 2) + '\n', 'utf8');
      console.log('Successfully synced heat-sources into openapi.json cleanly.');
    } catch (err) {
      console.error('Failed to sync heat-sources:', err);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching backend api-docs:', err.message);
  process.exit(1);
});
