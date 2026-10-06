import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.FR03_API_BASE_URL ?? 'http://localhost:8080/api/v1';
const username = process.env.FR03_API_USERNAME ?? 'sysadmin@ssds.dev';
const password = process.env.FR03_API_PASSWORD ?? 'Ssds@2026';
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('FR03 新增、補件、評分與刪除流程', { timeout: 45_000 }, async () => {
  let productId;
  try {
    const [categories, suppliers, festivals] = await Promise.all([
      api('/categories'),
      api('/suppliers'),
      api('/festivals'),
    ]);
    const category = firstCategory(categories);
    const supplier = suppliers[0];
    const festival = festivals[0];
    assert.ok(category?.id, '測試環境必須至少有一個類別');
    assert.ok(supplier?.id, '測試環境必須至少有一個供應商');
    assert.ok(festival?.festivalCode, '測試環境必須至少有一個節慶');

    const uniqueName = `FR03-E2E-${Date.now()}`;
    const createResult = await api('/products', {
      method: 'POST',
      json: {
        name: uniqueName,
        categoryId: category.id,
        supplierId: supplier.id,
        cost: 60,
        suggestedPrice: 100,
        moq: 10,
        shelfLifeDays: 90,
        season: 'ALL',
        trackType: 'A',
        logisticsConditions: ['NORMAL'],
        keywordIds: [],
        saveAsDraft: false,
      },
    });
    productId = createResult.product.id;
    assert.ok(productId, '新增品項應回傳 ID');

    await api(`/products/${productId}/festival-affinity`, {
      method: 'PUT',
      json: { affinities: [{ festivalCode: festival.festivalCode, affinity: 0.8 }] },
    });

    const csv = [
      'content,source,rating,reviewed_at',
      `FR03 E2E review ${Date.now()},E2E,4.5,2026-08-31`,
    ].join('\n');
    const formData = new FormData();
    formData.append('file', new Blob([csv], { type: 'text/csv' }), 'fr03-reviews.csv');
    const reviewResult = await api(`/products/${productId}/comments-file`, {
      method: 'POST',
      body: formData,
    });
    assert.equal(reviewResult.acceptedRows, 1);

    const marginMedian = await api(`/categories/${category.id}/margin-median`);
    assert.equal(marginMedian.categoryId, category.id);
    assert.ok(marginMedian.sampleCount >= 1);

    const task = await api('/products/batch/analyze', {
      method: 'POST',
      json: { productIds: [productId] },
    });
    assert.equal(task.queuedCount, 1);

    const scoredProduct = await waitForScore(uniqueName, productId);
    assert.equal(scoredProduct.id, productId);
    assert.equal(typeof scoredProduct.latestScore, 'number');
  } finally {
    if (productId != null) {
      await api(`/products/${productId}`, { method: 'DELETE' });
    }
  }
});

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', authorization);
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
  });
  const payload = await response.json().catch(() => null);
  assert.equal(
    response.ok,
    true,
    `${options.method ?? 'GET'} ${path} 失敗：${JSON.stringify(payload)}`,
  );
  assert.equal(payload?.success, true, payload?.error?.message ?? `${path} 回傳失敗`);
  return payload.data;
}

function firstCategory(nodes) {
  for (const node of nodes ?? []) {
    if (node.id != null) return node;
    const child = firstCategory(node.children);
    if (child) return child;
  }
  return null;
}

async function waitForScore(keyword, productId) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const page = await api(`/products?keyword=${encodeURIComponent(keyword)}&size=20`);
    const product = page.content?.find((item) => item.id === productId);
    if (product?.latestScore != null) return product;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.fail(`品項 ${productId} 在期限內沒有產生分數`);
}
