import { expect, it } from "vitest";
import { cartLineCents, cartSubtotalCents, formatMoney } from "./money";

it("calculates and displays R0.29 times three as exactly R0.87", () => {
    const item = { priceCents: 29, quantity: 3 };
    expect(cartLineCents(item)).toBe(87n);
    expect(cartSubtotalCents([item, { priceCents: 1, quantity: 13 }])).toBe(100n);
    expect(formatMoney(cartLineCents(item))).toBe("R 0.87");
    expect(cartSubtotalCents([])).toBe(0n);
});

it("formats cents, historical adjustments and large aggregate values without float arithmetic", () => {
    expect(formatMoney(0)).toBe("R 0.00");
    expect(formatMoney(-1)).toBe("-R 0.01");
    expect(formatMoney(123456)).toBe("R 1,234.56");
    expect(formatMoney(900719925474099301n)).toBe("R 9,007,199,254,740,993.01");
});
