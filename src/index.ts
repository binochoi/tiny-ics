// RFC5545(iCalendar) 최소 요건만 구현한 VCALENDAR/VEVENT 문자열 빌더.
// 특정 도메인 스키마를 모르는 순수 변환 계층 — 호출부가 이미 정규화된
// (allDay 이면 endDate 를 exclusive 로) 값을 넘겨준다는 전제.

export interface IcsEventInput {
  /** 캘린더 전역에서 고유해야 하는 이벤트 식별자 (예: `event-123@example.com`) */
  uid: string;
  title: string;
  description?: string;
  startDate: Date;
  /** allDay 이면 RFC5545 규약대로 exclusive end(마지막 날 다음날 00:00 UTC)로 정규화해서 넘긴다 */
  endDate: Date;
  allDay: boolean;
}

export interface IcsCalendarInput {
  /** RFC5545 PRODID 값 (예: `-//My App//Calendar//EN`). 기본값: `-//ics//Calendar//EN` */
  prodId?: string;
  calendarName: string;
  events: IcsEventInput[];
}

const CRLF = "\r\n";
const FOLD_LIMIT = 75;

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// RFC5545 3.1 라인 폴딩: 75옥텟(바이트) 넘는 줄은 CRLF + 스페이스 1개로 이어붙인다.
// 멀티바이트 UTF-8 문자 중간을 자르지 않도록 continuation byte 위치까지 경계를 되돌린다.
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= FOLD_LIMIT) return line;

  const chunks: string[] = [];
  let offset = 0;
  let limit = FOLD_LIMIT;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    while (end < bytes.length && ((bytes[end] as number) & 0b11000000) === 0b10000000) end--;
    chunks.push(new TextDecoder().decode(bytes.slice(offset, end)));
    offset = end;
    limit = FOLD_LIMIT - 1; // 이어지는 줄은 앞에 붙는 공백 1개만큼 여유를 줄인다
  }
  return chunks.join(`${CRLF} `);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function formatDateTimeUtc(date: Date): string {
  return `${formatDateOnly(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function buildEventLines(event: IcsEventInput, dtstamp: string): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${escapeText(event.uid)}`, `DTSTAMP:${dtstamp}`];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(event.endDate)}`);
  } else {
    lines.push(`DTSTART:${formatDateTimeUtc(event.startDate)}`);
    lines.push(`DTEND:${formatDateTimeUtc(event.endDate)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  lines.push("END:VEVENT");
  return lines;
}

/** 이벤트 목록을 하나의 VCALENDAR 문자열로 직렬화한다. `now` 는 테스트에서 DTSTAMP 고정용으로만 주입. */
export function buildIcsCalendar(input: IcsCalendarInput, now: Date = new Date()): string {
  const dtstamp = formatDateTimeUtc(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${input.prodId ?? "-//ics//Calendar//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
    ...input.events.flatMap((event) => buildEventLines(event, dtstamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
