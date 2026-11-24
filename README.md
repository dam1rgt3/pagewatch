# PageWatch

[Open PageWatch](https://dam1rgt3.github.io/pagewatch/) · [Careers example](https://dam1rgt3.github.io/pagewatch/careers.html)

Track a specific part of a public web page. Choose its title, the text under a heading, or a single element such as a price. Each watch keeps its latest value and up to ten changes. The comparison highlights the words added and removed.

## Try a watch

1. Open the site and choose **Use a sample**, or paste a URL and choose **Preview selection**.
2. For a section, enter the heading as printed on the source page. Previewing with an empty heading lists available headings when the source permits browser reads. For an element, enter a unique ID, class or attribute selector, such as `#deadline` or `[itemprop="price"]`.
3. Choose **Save in this browser** to keep a personal watch. Click **Check now** when you want another reading. These watches stay in browser storage, so clearing site data removes them.
4. For background checks, choose **Set up on GitHub** and submit the prefilled issue. Public watch setup requires a GitHub account; viewing the dashboard does not. Its URL, selection, captured text and earlier versions are public, including in the repository’s Git history. Use public information only. Close the issue to stop checks or edit its configuration to choose a different target.

Many sites restrict cross-origin browser previews. A scheduled watch fetches public HTML directly from a GitHub runner, so it can often read those pages. Login-only content, values rendered only after JavaScript runs, non-HTML files and sites that block automated requests are outside this version. HTTPS is recommended for private browser watches. A selection must be unique, readable and at most 1,600 characters; an unavailable source or missing selection preserves the last good value. Only lightweight public pages up to 2 MiB on standard web ports are fetched.

## How it works

The first successful observation saves a baseline. Subsequent checks compare only the chosen text after whitespace normalization. Stable surrounding copy and changes elsewhere on the page produce no event. The watch cards show exactly when an observed change was detected. A changed URL or selection starts a fresh baseline.

Scheduled checks run at 02:17, 08:17, 14:17 and 20:17 UTC. Opening, editing, closing or reopening a watch issue also starts a collection. Up to 24 watches are fetched per run, checking the least recently attempted first. Public snapshots are kept on the [history branch](https://github.com/dam1rgt3/pagewatch/tree/history). The public fetching job has read-only permissions and uses a validated public IPv4 address for each redirect. A separate job persists results and publishes the site.

## Careers example

The original careers dashboard still tracks titles, locations and postings on the public Greenhouse boards of Figma, Duolingo and Anthropic. It retains the last 90 days of detected events.

| Observation | What appears |
| --- | --- |
| A new posting ID appears after a baseline | Added, with the current title and location |
| The same ID has a different title or location | Updated, with the previous and current values |
| Rows change order, whitespace changes, or tracking URLs change | No change event |
| A posting disappears for one successful check | Removed from the current list, pending confirmation in the feed |
| A posting is absent on two successful checks | Removed, with the last observed title and location |
| A source times out or returns an invalid or incomplete list | The last successful data stays visible with a source warning |

A removal records absence from the public board. A company might repost the same role with a different ID. A work arrangement can be detected when it appears in the tracked title or location. The collector skips general-interest prospect posts and does not track edits inside job descriptions. Event times show when PageWatch observed a change.

## Run locally

Use Node.js 22 or later. Install dependencies with `npm ci`, run `npm test`, then `npm start`. The local site opens on [port 8783](http://127.0.0.1:8783). Run `npm run collect` to populate the local careers snapshot. The bundled sample is also available from the hosted demo.

[Public page snapshot](https://dam1rgt3.github.io/pagewatch/data/pages.json) · [Careers snapshot](https://dam1rgt3.github.io/pagewatch/data/watch.json) · [Production checks](https://github.com/dam1rgt3/pagewatch/actions/workflows/watch.yml)
