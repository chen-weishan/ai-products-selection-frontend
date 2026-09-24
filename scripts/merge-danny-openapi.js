const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const openApiPath = path.resolve(__dirname, '../openapi.json');
const currentDoc = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const dannyDoc = JSON.parse(execSync('git show origin/Danny:openapi.json', { encoding: 'utf8' }));

let addedPaths = 0;
for (const [p, val] of Object.entries(dannyDoc.paths || {})) {
  if (!currentDoc.paths[p]) {
    currentDoc.paths[p] = val;
    addedPaths++;
  }
}

// Fix duplicate operationId: /imports/{batchId} GET -> getImportBatch
if (currentDoc.paths['/imports/{batchId}'] && currentDoc.paths['/imports/{batchId}'].get) {
  currentDoc.paths['/imports/{batchId}'].get.operationId = 'getImportBatch';
}

let addedSchemas = 0;
for (const [s, val] of Object.entries(dannyDoc.components?.schemas || {})) {
  if (!currentDoc.components.schemas[s]) {
    currentDoc.components.schemas[s] = val;
    addedSchemas++;
  }
}

// Remove uniqueItems from all schema properties
let removedUnique = 0;
for (const [schemaName, schema] of Object.entries(currentDoc.components?.schemas || {})) {
  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      if (prop.uniqueItems !== undefined) {
        delete prop.uniqueItems;
        removedUnique++;
      }
    }
  }
}

fs.writeFileSync(openApiPath, JSON.stringify(currentDoc, null, 2) + '\n', 'utf8');
console.log(`[merge-openapi] Added ${addedPaths} paths, ${addedSchemas} schemas, removed ${removedUnique} uniqueItems.`);
