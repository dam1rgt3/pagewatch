# PageWatch

[Open the live careers watch](https://dam1rgt3.github.io/pagewatch/)

PageWatch compares public job listings at Figma, Duolingo and Anthropic. Browse the current openings, search by role or location, or open the change feed to see exactly which wording changed. All times in the dashboard use the visitor’s time zone.

![Scheduled check and deployment](https://github.com/dam1rgt3/pagewatch/actions/workflows/watch.yml/badge.svg)

## Try it

Choose a company, open **Open roles**, and search for a title or city. Select a role to see the original posting. Open **Changes** to review observations from the last 90 days. **View an example** illustrates a location edit with fictional data in a separate dialog.

The first successful check establishes a baseline. A new monitor can show openings immediately and an empty change feed until a later observation differs.

## How it works

A Node.js collector checks the public [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) four times a day. Company links go directly to the original careers pages. No account or API key is needed.

| Observation | What appears |
| --- | --- |
| A new posting ID appears after a baseline | Added, with the current title and location |
| The same ID has a different title or location | Updated, with the previous and current values |
| Rows change order, whitespace changes, or tracking URLs change | No change event |
| A posting disappears for one successful check | Removed from the current list, pending confirmation in the feed |
| A posting is absent on two successful checks | Removed, with the last observed title and location |
| A source times out or returns an invalid or incomplete list | The last successful data stays visible with a source warning |

A removal records absence from the public board. A company might repost the same role with a different ID. A work arrangement can be detected when it appears in the tracked title or location. The collector skips general-interest prospect posts and does not track edits inside job descriptions. Event times show when PageWatch observed a change.

## Data and checks

GitHub Actions runs at 02:17, 08:17, 14:17 and 20:17 UTC. Each successful collection produces a versioned [snapshot on the history branch](https://github.com/dam1rgt3/pagewatch/tree/history). The dashboard reads the deployed copy. A failed source is recorded independently. Tests run before collection, and a browser check exercises the published site after deployment.

- [Latest snapshot](https://dam1rgt3.github.io/pagewatch/data/watch.json)
- [Collection and publication runs](https://github.com/dam1rgt3/pagewatch/actions/workflows/watch.yml)
- [Diff logic](src/monitor.mjs) and [regression tests](tests/monitor.test.mjs)

## Run locally

Use Node.js 22 or later. The collector and dashboard use built-in APIs and have no runtime dependencies.

```sh
npm test
npm run collect
npm start
```

Open [localhost on port 8783](http://127.0.0.1:8783). Run the collector again later to compare with the previous snapshot. To adapt the watchlist, edit the company entries in `src/monitor.mjs`. Forks can enable GitHub Actions and choose **GitHub Actions** as their Pages publishing source.
