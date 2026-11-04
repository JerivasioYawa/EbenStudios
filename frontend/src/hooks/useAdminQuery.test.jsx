import { expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdminQuery } from "./useAdminQuery";

it("aborts stale admin searches and ignores late responses", async () => {
    let oldResponse;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve; }))
        .mockResolvedValueOnce({ items: ["Current results"] });
    const view = renderHook(({ q }) => useAdminQuery(fetcher, { q }), { initialProps: { q: "Old" } });
    view.rerender({ q: "New" });
    await waitFor(() => expect(view.result.current.data?.items).toEqual(["Current results"]));
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => oldResponse({ items: ["Stale results"] }));
    expect(view.result.current.data.items).toEqual(["Current results"]);
});
