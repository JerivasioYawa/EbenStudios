import { expect, it } from "vitest";
import { safeLoginReturn } from "./loginReturn";

it("preserves the internal product path, query, and hash", () => {
    expect(safeLoginReturn("/products/12?source=shop#details")).toBe("/products/12?source=shop#details");
});

it.each([undefined, "https://elsewhere.test/", "//elsewhere.test/", "/\\elsewhere.test/", "/login", "/register"])(
    "rejects unsafe or circular login return locations (%s)", (value) => { expect(safeLoginReturn(value)).toBe("/"); },
);
