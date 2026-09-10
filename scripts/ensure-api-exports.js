const fs = require('fs');
const path = require('path');

const apiDir = path.resolve(__dirname, '../src/app/api/api');
const modelDir = path.resolve(__dirname, '../src/app/api/model');

// 1. 修復 model/models.ts
if (fs.existsSync(modelDir)) {
  const modelFiles = fs.readdirSync(modelDir)
    .filter(f => f.endsWith('.ts') && f !== 'models.ts')
    .map(f => f.replace(/\.ts$/, ''));

  const modelExports = modelFiles.sort().map(name => `export * from './${name}';`).join('\n') + '\n';
  fs.writeFileSync(path.join(modelDir, 'models.ts'), modelExports, 'utf8');
  console.log(`[ensure-api-exports] ✅ 成功維護 models.ts (共匯出 ${modelFiles.length} 個 Model)`);
}

// 2. 修復 api/api.ts
if (fs.existsSync(apiDir)) {
  const allFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts') && f !== 'api.ts');
  const serviceFiles = allFiles.filter(f => f.endsWith('.service.ts')).map(f => f.replace(/\.ts$/, ''));
  const interfaceFiles = allFiles.filter(f => f.endsWith('.serviceInterface.ts')).map(f => f.replace(/\.ts$/, ''));

  const exportStatements = [];
  const serviceClasses = [];

  // Service 匯入與匯出
  serviceFiles.forEach(s => {
    // 檔名轉 PascalCase 類別名稱 (如 sourcingScoutController.service -> SourcingScoutControllerService)
    const baseName = s.replace('.service', '');
    const className = baseName.charAt(0).toUpperCase() + baseName.slice(1) + 'Service';
    exportStatements.push(`export * from './${s}';`);
    exportStatements.push(`import { ${className} } from './${s}';`);
    serviceClasses.push(className);
  });

  // Interface 匯出
  interfaceFiles.forEach(i => {
    exportStatements.push(`export * from './${i}';`);
  });

  const apiContent = exportStatements.join('\n') + `\n\nexport const APIS = [\n  ${serviceClasses.sort().join(',\n  ')}\n];\n`;
  fs.writeFileSync(path.join(apiDir, 'api.ts'), apiContent, 'utf8');
  console.log(`[ensure-api-exports] ✅ 成功維護 api.ts (共匯出 ${serviceFiles.length} 個 Service)`);
}
