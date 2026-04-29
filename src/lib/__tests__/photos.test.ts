import { orphanFilenames } from "../photos";

const DIR = "/tmp/test/receipts/";

describe("orphanFilenames", () => {
  test("returns names not referenced by any keep URI", () => {
    const present = ["a.jpg", "b.jpg", "c.jpg"];
    const keep = [`${DIR}a.jpg`, `${DIR}c.jpg`];
    expect(orphanFilenames(present, keep, DIR)).toEqual(["b.jpg"]);
  });

  test("ignores keep URIs outside the dir prefix", () => {
    const present = ["a.jpg"];
    const keep = ["/some/other/path/a.jpg"];
    expect(orphanFilenames(present, keep, DIR)).toEqual(["a.jpg"]);
  });

  test("null/undefined keep entries are tolerated", () => {
    const present = ["a.jpg"];
    const keep = [null, undefined, `${DIR}a.jpg`];
    expect(orphanFilenames(present, keep, DIR)).toEqual([]);
  });

  test("empty present list returns empty result", () => {
    expect(orphanFilenames([], [`${DIR}a.jpg`], DIR)).toEqual([]);
  });

  test("everything orphaned when keep list is empty", () => {
    expect(orphanFilenames(["a", "b"], [], DIR)).toEqual(["a", "b"]);
  });
});
