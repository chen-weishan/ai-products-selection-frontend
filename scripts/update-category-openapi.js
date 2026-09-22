const fs = require('fs');
const path = 'openapi.json';
const doc = JSON.parse(fs.readFileSync(path, 'utf8'));
if (doc.paths && doc.paths['/categories'] && doc.paths['/categories'].get) {
  doc.paths['/categories'].get.responses['200'].content = {
    'application/json': {
      schema: {
        '$ref': '#/components/schemas/ApiResponseListCategoryTreeResponse'
      }
    }
  };
  fs.writeFileSync(path, JSON.stringify(doc, null, 2), 'utf8');
  console.log('Successfully updated openapi.json for /categories to application/json');
} else {
  console.error('Could not find /categories in openapi.json');
}
