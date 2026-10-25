// Offline tests: index.js against a local fake of the Apify API (no token or network needed).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, test } from 'node:test';
import { ACTOR_ID, main } from '../index.js';

const ITEMS = [{ name: 'first', price: 1 }, { name: 'second', price: 2 }];
let server;
let calls;
let runStatus;

function run() {
    return {
        data: {
            id: 'run1', actId: 'act1', status: runStatus, defaultDatasetId: 'ds1',
            statusMessage: runStatus === 'SUCCEEDED' ? null : 'Input is invalid',
        },
    };
}

beforeEach(async () => {
    calls = [];
    runStatus = 'SUCCEEDED';
    server = createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            let body = Buffer.concat(chunks);
            if (req.headers['content-encoding'] === 'gzip') body = gunzipSync(body);
            calls.push({ method: req.method, url: req.url, body: body.length ? JSON.parse(body) : null });
            const path = req.url.split('?')[0];
            if (path.endsWith('/log')) {
                res.writeHead(200, { 'content-type': 'text/plain' }).end('');
            } else if (path === '/v2/datasets/ds1/items') {
                if (req.url.includes('format=csv')) {
                    res.writeHead(200, { 'content-type': 'text/csv' }).end('name,price\nfirst,1\nsecond,2\n');
                } else {
                    res.writeHead(200, { 'content-type': 'application/json', 'x-apify-pagination-total': '2' })
                        .end(JSON.stringify(ITEMS));
                }
            } else {
                res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' })
                    .end(JSON.stringify(run()));
            }
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    process.env.APIFY_TOKEN = 'test-token';
    process.env.APIFY_API_URL = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => server.close());

async function inputFile(data) {
    const dir = await mkdtemp(join(tmpdir(), 'apify-example-'));
    const path = join(dir, 'input.json');
    await writeFile(path, typeof data === 'string' ? data : JSON.stringify(data));
    return { dir, path };
}

test('a successful run saves JSON and CSV', async () => {
    const { dir, path } = await inputFile({ q: 'x' });
    assert.equal(await main([path, '--out', dir]), 0);
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'results.json'), 'utf8')), ITEMS);
    assert.match(await readFile(join(dir, 'results.csv'), 'utf8'), /^name,price\nfirst,1/);
    const start = calls.find((c) => c.method === 'POST');
    assert.match(start.url, new RegExp(`^/v2/act(or)?s/${ACTOR_ID.replace('/', '~')}/runs`));
    assert.deepEqual(start.body, { q: 'x' });
});

test('--max-charge is sent to Apify', async () => {
    const { dir, path } = await inputFile({});
    assert.equal(await main([path, '--out', dir, '--max-charge', '0.5']), 0);
    assert.match(calls.find((c) => c.method === 'POST').url, /maxTotalChargeUsd=0\.5/);
});

test('a failed run returns 1 and writes nothing', async () => {
    runStatus = 'FAILED';
    const { dir, path } = await inputFile({});
    assert.equal(await main([path, '--out', dir]), 1);
    await assert.rejects(readFile(join(dir, 'results.json')));
});

test('a missing token stops before any request', async () => {
    delete process.env.APIFY_TOKEN;
    const { path } = await inputFile({});
    await assert.rejects(main([path]), /APIFY_TOKEN/);
    assert.equal(calls.length, 0);
});

for (const [content, message] of [[null, /not found/], ['{oops', /not valid JSON/], ['[1]', /JSON object/]]) {
    test(`a bad input file is reported: ${message}`, async () => {
        const { dir, path } = await inputFile(content ?? '{}');
        await assert.rejects(main([content === null ? join(dir, 'missing.json') : path]), message);
    });
}

test('--max-charge must be a positive number', async () => {
    const { path } = await inputFile({});
    await assert.rejects(main([path, '--max-charge', 'abc']), /positive number/);
});

test('the bundled input.json is a JSON object', async () => {
    const data = JSON.parse(await readFile(new URL('../input.json', import.meta.url), 'utf8'));
    assert.equal(typeof data, 'object');
    assert.ok(!Array.isArray(data));
});
