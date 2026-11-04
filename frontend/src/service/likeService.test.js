import { beforeEach, expect, it, vi } from "vitest";
import api from "./api";
import { mergeGuestLikes } from "./likeService";
import { GUEST_LIKES_KEY, readGuestLikes, toggleGuestLike } from "./guestLikes";

vi.mock("./api", () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem("eben_auth_token", "session-a");
    api.put.mockResolvedValue({ data: {} });
});

it("persists and toggles unique guest IDs while rejecting corrupt or invalid saved values", () => {
    localStorage.setItem(GUEST_LIKES_KEY, JSON.stringify([1, 1, 2, -1, 0, "3", null, 1.5]));
    expect(readGuestLikes()).toEqual([1, 2]);
    toggleGuestLike(1);
    expect(readGuestLikes()).toEqual([2]);
    toggleGuestLike(3);
    expect(readGuestLikes()).toEqual([2, 3]);
    localStorage.setItem(GUEST_LIKES_KEY, "broken json");
    expect(readGuestLikes()).toEqual([]);
    expect(api.put).not.toHaveBeenCalled();
});

it("reports local storage failures without pretending a guest like was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => toggleGuestLike(1)).toThrow("Unable to save your likes on this device.");
    expect(readGuestLikes()).toEqual([]);
});

it("merges each unique guest like and does not merge consumed likes again", async () => {
    localStorage.setItem(GUEST_LIKES_KEY, JSON.stringify([1, 1, 2]));
    const config = { sessionToken: "session-a" };
    await mergeGuestLikes(config);
    expect(api.put.mock.calls.map(call => call[0])).toEqual(["/likes/1", "/likes/2"]);
    expect(readGuestLikes()).toEqual([]);
    expect(localStorage.getItem(GUEST_LIKES_KEY)).toBeNull();
    await mergeGuestLikes(config);
    expect(api.put).toHaveBeenCalledTimes(2);
});

it("retains failed and unattempted guest likes so a partial merge can resume safely", async () => {
    localStorage.setItem(GUEST_LIKES_KEY, JSON.stringify([1, 2, 3]));
    api.put.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error("offline"));
    await expect(mergeGuestLikes({ sessionToken: "session-a" })).rejects.toThrow("offline");
    expect(readGuestLikes()).toEqual([2, 3]);
    await mergeGuestLikes({ sessionToken: "session-a" });
    expect(api.put.mock.calls.map(call => call[0])).toEqual(["/likes/1", "/likes/2", "/likes/2", "/likes/3"]);
    expect(readGuestLikes()).toEqual([]);
});

it("discards deleted product IDs and continues merging available products", async () => {
    localStorage.setItem(GUEST_LIKES_KEY, JSON.stringify([1, 2]));
    api.put.mockRejectedValueOnce({ response: { status: 404 } });
    await mergeGuestLikes({ sessionToken: "session-a" });
    expect(readGuestLikes()).toEqual([]);
    expect(api.put).toHaveBeenCalledTimes(2);
});

it("does not consume guest preferences using a response from an old account", async () => {
    localStorage.setItem(GUEST_LIKES_KEY, "[1]");
    api.put.mockImplementationOnce(async () => {
        localStorage.setItem("eben_auth_token", "session-b");
        return { data: {} };
    });
    await expect(mergeGuestLikes({ sessionToken: "session-a" })).rejects.toThrow(/account changed/i);
    expect(readGuestLikes()).toEqual([1]);
});
