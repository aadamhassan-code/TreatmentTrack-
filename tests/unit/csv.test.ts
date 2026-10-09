import { describe, expect, test } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  test("reads a simple file", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  test("handles quoted commas, escaped quotes and line breaks inside quotes", () => {
    expect(parseCsv('name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\n')).toEqual([
      ["name", "note"],
      ["Smith, Jo", 'said "hi"\nthen left'],
    ]);
  });

  test("strips Excel's byte-order mark and drops blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  test("reads semicolon-separated files", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  test("keeps a last line without a newline", () => {
    expect(parseCsv("a\nx")).toEqual([["a"], ["x"]]);
  });
});
