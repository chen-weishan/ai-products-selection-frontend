const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const openApiPath = path.resolve(__dirname, '../openapi.json');
const currentDoc = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const demisakDoc = JSON.parse(execSync('git show origin/Demisak:openapi.json', { encoding: 'utf8' }));

// 1. Add missing paths
const pathsToSync = [
  ['/ai/tasks', 'get'],
  ['/ai/tasks/summary', 'get'],
  ['/ai/tasks/{taskId}/cancel', 'post']
];

for (const [p, m] of pathsToSync) {
  if (demisakDoc.paths[p] && demisakDoc.paths[p][m]) {
    if (!currentDoc.paths[p]) {
      currentDoc.paths[p] = {};
    }
    currentDoc.paths[p][m] = demisakDoc.paths[p][m];
    console.log(`Synced path: ${m.toUpperCase()} ${p}`);
  }
}

// 2. Add missing schemas
const schemasToSync = [
  'AiTaskSummaryResponse',
  'ApiResponseAiTaskSummaryResponse',
  'PageResponseAiTaskResponse',
  'ApiResponsePageResponseAiTaskResponse'
];

for (const s of schemasToSync) {
  if (demisakDoc.components?.schemas?.[s]) {
    if (!currentDoc.components.schemas) currentDoc.components.schemas = {};
    currentDoc.components.schemas[s] = demisakDoc.components.schemas[s];
    console.log(`Synced schema: ${s}`);
  }
}

// 3. Remove uniqueItems from all schemas to ensure standard Array generation
for (const [schemaName, schema] of Object.entries(currentDoc.components?.schemas || {})) {
  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      if (prop.uniqueItems !== undefined) {
        delete prop.uniqueItems;
      }
    }
  }
}

fs.writeFileSync(openApiPath, JSON.stringify(currentDoc, null, 2) + '\n', 'utf8');
console.log('Successfully updated openapi.json with ai-tasks endpoints and schemas.');
