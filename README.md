<p align="center"><a href="https://apify.com/DevilScrapes/telegram-channel-scraper"><img src="assets/banner.svg" alt="Telegram Channel Scraper — JavaScript example" width="100%"></a></p>

# Telegram Channel Scraper for JavaScript and Node.js: public channel posts as JSON for your app

<p align="center">
<a href="https://apify.com/DevilScrapes/telegram-channel-scraper"><img alt="Run on Apify" src="https://img.shields.io/badge/Run%20on-Apify-DC2626?logo=apify&logoColor=white"></a>
<img alt="JavaScript" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white">
<a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0A0606"></a>
<a href="https://github.com/devilscrapes/telegram-channel-scraper-javascript/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/devilscrapes/telegram-channel-scraper-javascript/actions/workflows/ci.yml/badge.svg"></a>
</p>

Here is a Node.js client for the **[Telegram Channel Scraper](https://apify.com/DevilScrapes/telegram-channel-scraper)**, written as one ES module on top of `apify-client`. Give it public channel names such as `telegram` and it returns plain objects: every post with permalink, timestamp, text, views, media and forward source, plus a header object per channel with title and subscriber count. The Actor runs on Apify, which means your service never has to register a Telegram app, keep a logged-in session alive or rotate phone numbers. Use the saved `results.json` and `results.csv`, or import the core call and keep the rows in memory.

> **Actor:** [Telegram Channel Scraper](https://apify.com/DevilScrapes/telegram-channel-scraper) · **Publisher:** [Devil Scrapes](https://apify.com/DevilScrapes) · **Also in Python:** [telegram-channel-scraper-python](https://github.com/devilscrapes/telegram-channel-scraper-python)

## 🔥 What you get

- **Two row shapes in one dataset**: a `channel_meta` row per channel (display title, subscriber total, about text) sits next to the `post` rows, and `row_type` tells them apart.
- **Posts with their context**: each message keeps its numeric ID, UTC timestamp, plain text with line breaks, view total, media kind and link, the URLs it points to and the channel it was forwarded from.
- **Any username format**: `telegram`, `@telegram`, `t.me/telegram` and `https://t.me/s/telegram` all resolve to the same channel, and repeats in the list are dropped.
- **Goes back in time**: the Actor follows Telegram's older-posts cursor page by page until it reaches your per-channel cap or the cut-off date.
- **Dead channels do not kill the batch**: a private, renamed or missing channel is logged and skipped, and the run summary counts how many were skipped.
- **Throttling is handled server-side**: temporary errors are retried with growing pauses and a fresh proxy session, so a busy moment on Telegram's side rarely costs you a channel.
- **Metadata rows are free**: only `post` rows trigger the per-result charge.

## 🎯 Use cases

### Mirror a channel into your own product

Run the scraper from a scheduled worker and upsert posts by `channel` plus `post_id`. A status page, an intranet news widget or a mobile app can then show an organization's Telegram announcements without embedding Telegram's widget or asking users to install the app.

### Forward new posts to Slack, Discord or email

Keep the last seen `post_id` per channel in a key-value store, start a run every few minutes from a serverless cron, and send whatever is newer to an incoming webhook. The `permalink` field gives each notification a link back to the original message.

### Feed a search index or a RAG pipeline

Clean post text with preserved line breaks drops straight into Elasticsearch, Meilisearch or an embedding job. Store `datetime` and `channel` alongside the vector so answers can cite the exact source message and its date.

### Track channel growth in a dashboard

Each run writes one `channel_meta` object per channel with the current subscriber figure. Save it with a timestamp on every run and a small chart in your admin panel shows audience growth for the brands or competitors you follow.

## ⚡ Quick start

You need an Apify account and an API token from [Console → Settings → Integrations](https://console.apify.com/settings/integrations). Apify's free plan includes monthly usage credit; this Actor's event prices are listed under Pricing below.

```bash
git clone https://github.com/devilscrapes/telegram-channel-scraper-javascript.git
cd telegram-channel-scraper-javascript
npm install
export APIFY_TOKEN=your_token_here
node index.js                       # uses input.json
node index.js my-input.json --out data --max-charge 2
```

The script starts the [Telegram Channel Scraper](https://apify.com/DevilScrapes/telegram-channel-scraper), waits for it to finish, prints a link to the run in Apify Console and saves every result to `results.json` and `results.csv`. It exits with code 1 and the run's status message if the run fails.

## 🧩 The core call

This is the minimum a backend needs. `call()` resolves once the run reaches a terminal state, and `listItems()` reads the run's default dataset in one request; switch to the paginated form for long histories.

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_APIFY_TOKEN' });
const run = await client.actor('DevilScrapes/telegram-channel-scraper').call({"usernames": ["telegram"], "maxPostsPerChannel": 10, "proxyConfiguration": {"useApifyProxy": true}});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(items);
```

## 📥 Input

`index.js` forwards `input.json` untouched. The bundled example reads Telegram's official news channel and stops at ten posts, enough to see both row shapes for a few cents. Add usernames to the array to poll several channels in one run; they are fetched one after another.

```json
{
  "usernames": [
    "telegram"
  ],
  "maxPostsPerChannel": 10,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

| Field | Type | Required | Default | Allowed values |
|---|---|---|---|---|
| `usernames` | array | yes | `["durov"]` | — |
| `maxPostsPerChannel` | integer | no | `100` | — |
| `sinceDate` | string | no | — | — |
| `proxyConfiguration` | object | no | `{"useApifyProxy": true}` | — |

## 📤 Output

Each item is either a post or a channel header, and `row_type` says which. Branch on it before you map rows into your own types, since header-only fields are `null` on posts and vice versa. Counts such as views arrive as integers, already expanded from Telegram's `K` and `M` notation. The array is not in strict chronological order, so sort on `post_id` when order matters.

| Field | Type | Always present |
|---|---|---|
| `row_type` | string | yes |
| `channel` | string | yes |
| `post_id` | integer or null | no |
| `datetime` | string or null | no |
| `text` | string or null | no |
| `view_count` | integer or null | no |
| `media_type` | string or null | no |
| `media_url` | string or null | no |
| `outbound_links` | array or null | no |
| `forwarded_from` | string or null | no |
| `reply_count` | integer or null | no |
| `permalink` | string or null | no |
| `title` | string or null | no |
| `subscriber_count` | integer or null | no |
| `description` | string or null | no |

## 💰 Pricing

| Event | Price (USD) |
|---|---|
| Actor start | $0.2 |
| Post row emitted | $0.002 |

Prices as configured on 2026-08-20. The [Actor page](https://apify.com/DevilScrapes/telegram-channel-scraper) always shows the current price. Runs are billed to the Apify account that owns the token. Use `--max-charge` to cap what a single run can cost.

## 🛠️ Working with the data in JavaScript

This script is a ready-made "what's new" detector for a notifier. It remembers the highest post ID per channel in `last-seen.json`, prints only the posts that appeared since the previous run and updates the file. It needs nothing beyond Node.js built-ins.

```javascript
import { readFile, writeFile } from 'node:fs/promises';

const rows = JSON.parse(await readFile('results.json', 'utf8'));
const statePath = 'last-seen.json';
const lastSeen = JSON.parse(await readFile(statePath, 'utf8').catch(() => '{}'));

const fresh = rows
    .filter((row) => row.row_type === 'post' && row.post_id > (lastSeen[row.channel] ?? 0))
    .sort((a, b) => a.post_id - b.post_id);

for (const post of fresh) {
    lastSeen[post.channel] = Math.max(lastSeen[post.channel] ?? 0, post.post_id);
    const headline = (post.text ?? '').split('\n')[0].slice(0, 120);
    console.log(`${post.permalink} [${post.media_type}] ${headline}`);
}

await writeFile(statePath, JSON.stringify(lastSeen, null, 2));
const channels = new Set(fresh.map((post) => post.channel));
console.log(`${fresh.length} new post(s) in ${channels.size} channel(s)`);
```

## ❓ FAQ

### Can I run it from AWS Lambda, Vercel or Cloudflare Workers?

Yes, as long as the function can wait for the run. For short timeouts, start the Actor with `start()` instead of `call()` and let an Apify webhook ping your endpoint when the run succeeds; then fetch the dataset in that handler.

### Do I need a bot token or a Telegram app ID?

No. Only the `APIFY_TOKEN` is required. Nothing in this repository talks to the Telegram Bot API, so there is no bot to create and no chat it has to join.

### What happens if one channel in my list is private or deleted?

That channel is skipped and the rest are still collected. The run finishes successfully and its status message says how many channels had no public page, which your code can read from the run object.

### Does it download photos and videos?

It returns links, not files. `media_url` points to the image for photos, to a preview frame for videos and, for file posts, to whatever link Telegram puts on the document card. Fetch them yourself if you need the binaries, and expect Telegram's CDN links to change over time.

## 🧯 Troubleshooting

- **`Set APIFY_TOKEN first`**: export the token in the same shell, or put it in a local `.env` file your shell loads. Never commit it.
- **Run finished with `FAILED` or `ABORTED`**: open the printed Console link; the run log says why. Input validation errors name the field.
- **Fewer rows than expected**: a `--max-charge` cap also limits how many results can be charged. Raise the cap or lower the limits in your input.
- **Something looks wrong in the data**: open an issue on the [Actor page](https://apify.com/DevilScrapes/telegram-channel-scraper) so the maintainers see it.

## 🔗 More from Devil Scrapes

- [Telegram Channel Scraper on Apify Store](https://apify.com/DevilScrapes/telegram-channel-scraper)
- [Python version of this example](https://github.com/devilscrapes/telegram-channel-scraper-python)
- [All Devil Scrapes Actors](https://apify.com/DevilScrapes)
- [Apify web scraping cookbook](https://github.com/devilscrapes/apify-web-scraping-cookbook)

Related Actors:

- [Mastodon Posts Scraper — Hashtags & Accounts](https://apify.com/DevilScrapes/mastodon-posts-scraper) — the same kind of public timeline, collected from Mastodon hashtags and accounts.
- [Bluesky Scraper — Feed Posts](https://apify.com/DevilScrapes/bluesky-feed-posts) — posts and engagement counts from public Bluesky feeds.
- [Discord Server Metadata Lookup](https://apify.com/DevilScrapes/discord-server-scraper) — member and online counts for Discord communities from their invite links.

---

MIT licensed example code. The Actor itself runs on [Apify](https://apify.com/DevilScrapes/telegram-channel-scraper) and is maintained by [Devil Scrapes](https://apify.com/DevilScrapes). Not affiliated with Telegram or Telegram Messenger Inc..
