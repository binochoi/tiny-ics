import { describe, expect, test } from "vitest";
import { buildIcsCalendar } from "./index";

const NOW = new Date("2026-08-03T00:00:00Z");

describe("buildIcsCalendar", () => {
  test("기본 VCALENDAR 골격과 X-WR-CALNAME 을 포함한다", () => {
    const out = buildIcsCalendar({ calendarName: "내 캘린더", events: [] }, NOW);
    expect(out).toContain("BEGIN:VCALENDAR\r\n");
    expect(out).toContain("VERSION:2.0\r\n");
    expect(out).toContain("X-WR-CALNAME:내 캘린더\r\n");
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("allDay 이벤트는 DTSTART/DTEND 를 VALUE=DATE 로 렌더링한다", () => {
    const out = buildIcsCalendar(
      {
        calendarName: "cal",
        events: [
          {
            uid: "event-1@example.com",
            title: "출시일",
            startDate: new Date("2026-08-10T00:00:00Z"),
            endDate: new Date("2026-08-11T00:00:00Z"),
            allDay: true,
          },
        ],
      },
      NOW,
    );
    expect(out).toContain("DTSTART;VALUE=DATE:20260810\r\n");
    expect(out).toContain("DTEND;VALUE=DATE:20260811\r\n");
  });

  test("시간 있는 이벤트는 DTSTART/DTEND 를 UTC datetime 으로 렌더링한다", () => {
    const out = buildIcsCalendar(
      {
        calendarName: "cal",
        events: [
          {
            uid: "event-2@example.com",
            title: "회의",
            startDate: new Date("2026-08-10T09:30:00Z"),
            endDate: new Date("2026-08-10T10:00:00Z"),
            allDay: false,
          },
        ],
      },
      NOW,
    );
    expect(out).toContain("DTSTART:20260810T093000Z\r\n");
    expect(out).toContain("DTEND:20260810T100000Z\r\n");
  });

  test("SUMMARY/DESCRIPTION 의 예약 문자를 이스케이프한다", () => {
    const out = buildIcsCalendar(
      {
        calendarName: "cal",
        events: [
          {
            uid: "event-3@example.com",
            title: "a; b, c\\d\ne",
            description: "line1\nline2",
            startDate: new Date("2026-08-10T00:00:00Z"),
            endDate: new Date("2026-08-11T00:00:00Z"),
            allDay: true,
          },
        ],
      },
      NOW,
    );
    expect(out).toContain("SUMMARY:a\\; b\\, c\\\\d\\ne\r\n");
    expect(out).toContain("DESCRIPTION:line1\\nline2\r\n");
  });

  test("description 이 없으면 DESCRIPTION 라인을 생략한다", () => {
    const out = buildIcsCalendar(
      {
        calendarName: "cal",
        events: [
          {
            uid: "event-4@example.com",
            title: "제목만",
            startDate: new Date("2026-08-10T00:00:00Z"),
            endDate: new Date("2026-08-11T00:00:00Z"),
            allDay: true,
          },
        ],
      },
      NOW,
    );
    expect(out).not.toContain("DESCRIPTION");
  });

  test("75옥텟 넘는 줄은 CRLF + 공백으로 폴딩된다", () => {
    const longTitle = "가".repeat(60); // UTF-8 3바이트 * 60 = 180바이트, 확실히 폴딩 대상
    const out = buildIcsCalendar(
      {
        calendarName: "cal",
        events: [
          {
            uid: "event-5@example.com",
            title: longTitle,
            startDate: new Date("2026-08-10T00:00:00Z"),
            endDate: new Date("2026-08-11T00:00:00Z"),
            allDay: true,
          },
        ],
      },
      NOW,
    );
    const summaryLine = out.split("\r\n").find((line) => line.startsWith("SUMMARY:"));
    expect(summaryLine).toBeDefined();

    // 폴딩된 각 물리 라인(CRLF 로 분리)이 75옥텟을 넘지 않아야 한다.
    const lines = out.split("\r\n");
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }

    // 이어지는 줄은 공백 1개로 시작해야 한다 (SUMMARY 라인 다음 줄 존재 여부로 폴딩 발생 확인)
    const summaryIndex = lines.findIndex((line) => line.startsWith("SUMMARY:"));
    expect(lines[summaryIndex + 1]?.startsWith(" ")).toBe(true);
  });
});
