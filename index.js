// Run the Telegram Channel Scraper on Apify and save its results as JSON and CSV.
// Actor page: https://apify.com/DevilScrapes/telegram-channel-scraper

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ApifyClient } from 'apify-client';

export const ACTOR_ID = 'DevilScrapes/telegram-channel-scraper';

class UsageError extends Error {}

function numberOption(name, value) {
    if (value === undefined) return undefined;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new UsageError(`--${name} must be a positive number`);
    return number;
}

function parseCli(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            out: { type: 'string', default: '.' },
            'max-charge': { type: 'string' },
            memory: { type: 'string' },
        },
    });
    return {
        inputPath: positionals[0] ?? 'input.json',
        out: values.out,
        maxCharge: numberOption('max-charge', values['max-charge']),
        memory: numberOption('memory', values.memory),
    };
}

async function loadInput(path) {
    let text;
    try {
        text = await readFile(path, 'utf8');
    } catch {
        throw new UsageError(`Input file not found: ${path}`);
    }
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new UsageError(`Input file ${path} is not valid JSON: ${error.message}`);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new UsageError(`Input file ${path} must contain a JSON object`);
    }
    return data;
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseCli(argv);
    const token = process.env.APIFY_TOKEN;
    if (!token) {
        throw new UsageError('Set APIFY_TOKEN first. Get a token at https://console.apify.com/settings/integrations');
    }
    const input = await loadInput(args.inputPath);
    const client = new ApifyClient({ token, baseUrl: process.env.APIFY_API_URL ?? 'https://api.apify.com' });

    console.log(`Starting ${ACTOR_ID} ...`);
    const run = await client.actor(ACTOR_ID).call(input, {
        maxTotalChargeUsd: args.maxCharge,
        memory: args.memory,
    });

    console.log(`Run ${run.id} finished: ${run.status}`);
    console.log(`Details: https://console.apify.com/actors/runs/${run.id}`);
    if (run.status !== 'SUCCEEDED') {
        console.error(run.statusMessage ?? 'No status message.');
        return 1;
    }

    const dataset = client.dataset(run.defaultDatasetId);
    await mkdir(args.out, { recursive: true });
    const { items } = await dataset.listItems({ clean: true });
    await writeFile(join(args.out, 'results.json'), `${JSON.stringify(items, null, 2)}\n`);
    await writeFile(join(args.out, 'results.csv'), await dataset.downloadItems('csv', { clean: true }));

    console.log(`Saved ${items.length} items to ${join(args.out, 'results.json')} and ${join(args.out, 'results.csv')}`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        process.exitCode = await main();
    } catch (error) {
        console.error(error instanceof UsageError ? error.message : error);
        process.exitCode = 1;
    }
}
