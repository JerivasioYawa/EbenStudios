import { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import AuthContext from "./auth-context";
import { LikesProvider } from "./LikesContext";
import { useLikes } from "../hooks/useLikes";
import * as service from "../service/likeService";
import { GUEST_LIKES_KEY, consumeGuestLike, readGuestLikes } from "../service/guestLikes";

vi.mock("../service/likeService", () => ({
    getLikes: vi.fn(), likeProduct: vi.fn(), unlikeProduct: vi.fn(), mergeGuestLikes: vi.fn(),
}));

beforeEach(() => {
    vi.resetAllMocks();
    service.getLikes.mockResolvedValue([]);
    service.mergeGuestLikes.mockResolvedValue();
});

function harness(initialAuth, strict = false) {
    let auth = initialAuth;
    const wrapper = ({ children }) => {
        const content = <AuthContext.Provider value={auth}><LikesProvider>{children}</LikesProvider></AuthContext.Provider>;
        return strict ? <StrictMode>{content}</StrictMode> : content;
    };
    const view = renderHook(() => useLikes(), { wrapper });
    return { ...view, setAuth(next) { auth = next; view.rerender(); } };
}

it("stores guest likes locally and restores them after a new mount without calling the likes API", async () => {
    const view = harness({ user: null, loading: false });
    await act(async () => { await view.result.current.toggleLike({ id: 1 }); });
    expect(view.result.current.likedIds).toEqual([1]);
    view.unmount();
    const again = harness({ user: null, loading: false });
    expect(again.result.current.isLiked(1)).toBe(true);
    await act(async () => { await again.result.current.toggleLike({ id: 1 }); });
    expect(readGuestLikes()).toEqual([]);
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
});

it("runs one merge/load job during Strict Mode effect replay", async () => {
    localStorage.setItem("eben_auth_token", "session-a");
    localStorage.setItem(GUEST_LIKES_KEY, "[1]");
    service.mergeGuestLikes.mockImplementation(async () => consumeGuestLike(1));
    service.getLikes.mockResolvedValue([{ id: 1, name: "A Tee" }]);
    const view = harness({ user: { id: 1 }, loading: false }, true);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.likedIds).toEqual([1]);
    expect(service.mergeGuestLikes).toHaveBeenCalledTimes(1);
    expect(service.getLikes).toHaveBeenCalledTimes(1);
    expect(readGuestLikes()).toEqual([]);
    view.rerender();
    expect(service.mergeGuestLikes).toHaveBeenCalledTimes(1);
});

it("rejects likes while authentication is still loading", async () => {
    const view = harness({ user: null, loading: true });
    await expect(view.result.current.toggleLike({ id: 1 })).rejects.toThrow(/check your session/i);
    expect(readGuestLikes()).toEqual([]);
    expect(service.likeProduct).not.toHaveBeenCalled();
});

it("never shows an old account's late likes response in the new account or after logout", async () => {
    localStorage.setItem("eben_auth_token", "session-a");
    let resolveA;
    service.getLikes.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
        .mockResolvedValueOnce([{ id: 2, name: "B Tee" }]);
    const view = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(service.getLikes).toHaveBeenCalledTimes(1));
    localStorage.setItem("eben_auth_token", "session-b");
    view.setAuth({ user: { id: 2 }, loading: false });
    await waitFor(() => expect(view.result.current.likedIds).toEqual([2]));
    await act(async () => { resolveA([{ id: 1 }]); });
    expect(view.result.current.likedIds).toEqual([2]);
    localStorage.removeItem("eben_auth_token");
    view.setAuth({ user: null, loading: false });
    expect(view.result.current.likedIds).toEqual([]);
    expect(readGuestLikes()).toEqual([]);
});

it("does not apply an old account's in-flight mutation after an account switch", async () => {
    localStorage.setItem("eben_auth_token", "session-a");
    let resolveLike;
    service.likeProduct.mockImplementationOnce(() => new Promise(resolve => { resolveLike = resolve; }));
    const view = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    let outcome;
    act(() => { outcome = view.result.current.toggleLike({ id: 1 }).catch(error => error); });
    localStorage.setItem("eben_auth_token", "session-b");
    view.setAuth({ user: { id: 2 }, loading: false });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { resolveLike({ id: 1 }); });
    expect((await outcome).message).toMatch(/account changed/i);
    expect(view.result.current.likedIds).toEqual([]);
});

it("shows merge errors and permits a deliberate retry without dropping guest preferences", async () => {
    localStorage.setItem("eben_auth_token", "session-a");
    localStorage.setItem(GUEST_LIKES_KEY, "[1]");
    service.mergeGuestLikes.mockRejectedValueOnce(new Error("offline"));
    const view = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(view.result.current.error).toMatch(/unable to sync/i));
    expect(readGuestLikes()).toEqual([1]);
    service.mergeGuestLikes.mockImplementation(async () => consumeGuestLike(1));
    service.getLikes.mockResolvedValue([{ id: 1 }]);
    act(() => view.result.current.refreshLikes());
    await waitFor(() => expect(view.result.current.likedIds).toEqual([1]));
    expect(view.result.current.error).toBe("");
    expect(readGuestLikes()).toEqual([]);
});
