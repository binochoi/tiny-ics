# tiny-ics

A tiny, zero-dependency **iCalendar (`.ics`) generator** for TypeScript and JavaScript. It turns a list of events into an [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) `VCALENDAR` / `VEVENT` string that Google Calendar, Apple Calendar, and Outlook can import or subscribe to. Use it to serve **calendar feeds and `webcal://` subscription URLs**, offer **"Add to calendar" `.ics` downloads**, or attach **calendar invites to emails**. It is a pure function with no runtime dependencies, so it runs in Node.js, browsers, Deno, Bun, and edge/serverless runtimes such as **Cloudflare Workers**.

## Why

Most iCalendar libraries are large because they also parse files, expand recurrence rules, and ship timezone data. This package only does serialization, and does it correctly:

- RFC 5545 text escaping (`\`, `;`, `,`, newlines)
- Line folding at 75 octets, without splitting multi-byte UTF-8 characters (Korean, Japanese, emoji, …)
- CRLF line endings
- All-day events (`VALUE=DATE`) and UTC date-time events
- Deterministic output for snapshot tests (inject `now`)

Out of scope: parsing `.ics` files, recurrence rules (`RRULE`), and timezone databases (`VTIMEZONE`).

## Use cases

- **Calendar subscription feed** — return the string from an HTTP endpoint with `Content-Type: text/calendar` and share it as a `webcal://` URL.
- **"Add to calendar" button** — let users download a `.ics` file for one or more events.
- **Email invites** — attach a `.ics` file to booking or meeting confirmation emails.

## Install

```sh
npm install tiny-ics
```

## Usage

```ts
import { buildIcsCalendar } from "tiny-ics";

const ics = buildIcsCalendar({
  prodId: "-//My App//Calendar//EN",
  calendarName: "My Calendar",
  events: [
    {
      uid: "event-1@example.com",
      title: "Team meeting",
      startDate: new Date("2026-08-10T09:00:00Z"),
      endDate: new Date("2026-08-10T10:00:00Z"),
      allDay: false,
    },
    {
      uid: "event-2@example.com",
      title: "Holiday",
      startDate: new Date("2026-08-15T00:00:00Z"),
      endDate: new Date("2026-08-16T00:00:00Z"), // exclusive end for all-day
      allDay: true,
    },
  ],
});
```

Serving it as a subscription feed (e.g. Cloudflare Workers, Hono, or any `fetch`-style handler):

```ts
return new Response(ics, {
  headers: { "Content-Type": "text/calendar; charset=utf-8" },
});
```

## API

### `buildIcsCalendar(input, now?)`

Returns a `VCALENDAR` string (CRLF line endings, RFC 5545 line folding at 75 octets).

- `input.prodId` — RFC 5545 `PRODID` value. Defaults to `-//ics//Calendar//EN`.
- `input.calendarName` — used as `X-WR-CALNAME`.
- `input.events` — list of events.
- `now` — optional `Date` for `DTSTAMP`; defaults to `new Date()`. Useful for deterministic tests.

### `IcsEventInput`

| Field | Type | Description |
|---|---|---|
| `uid` | `string` | Globally unique event ID (e.g. `event-123@example.com`) |
| `title` | `string` | Event title → `SUMMARY` |
| `description` | `string?` | Plain text → `DESCRIPTION` |
| `startDate` | `Date` | UTC start |
| `endDate` | `Date` | UTC end. For all-day events, pass the exclusive end (next day 00:00 UTC). |
| `allDay` | `boolean` | Emits `VALUE=DATE` instead of UTC datetime |

## Notes

- All-day `endDate` must already be the exclusive end — the caller is responsible for this normalization.
- `DESCRIPTION` is omitted when the field is absent or empty.
- RFC 5545 special characters (`\`, `;`, `,`, newlines) in text fields are escaped automatically.

## License

MIT
