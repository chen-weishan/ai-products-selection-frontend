const http = require('http');

http.get('http://localhost:8080/v3/api-docs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const doc = JSON.parse(data);
      const paths = Object.keys(doc.paths).filter(p => p.includes('heat'));
      console.log('Heat paths from backend:', paths);
    } catch (e) {
      console.error('Failed to parse api-docs:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('Failed to connect:', err.message);
});
