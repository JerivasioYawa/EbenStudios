import { useEffect, useRef, useState } from "react";
import LikesContext from "./likes-context";
import { useAuth } from "../hooks/useAuth";
import { getSessionToken } from "../service/session";
import { getLikes, likeProduct, unlikeProduct, mergeGuestLikes } from "../service/likeService";
import { GUEST_LIKES_KEY, GUEST_LIKES_CHANGED, readGuestLikes, toggleGuestLike } from "../service/guestLikes";

export function LikesProvider({ children }) {
    const { user, loading: authLoading, sessionId = 0 } = useAuth();
    const enabled = Boolean(user) && !authLoading;
    const ownerKey = enabled ? user.id + ":" + sessionId : "guest";
    const [guestIds, setGuestIds] = useState(readGuestLikes);
    const [account, setAccount] = useState(() => ({ ownerKey, products: [], loading: enabled, error: "", pendingIds: [] }));
    const [refreshVersion, setRefreshVersion] = useState(0);
    const sync = useRef(null);
    const currentOwner = useRef(ownerKey);
    const pending = useRef(new Map());

    if (account.ownerKey !== ownerKey) {
        setAccount({ ownerKey, products: [], loading: enabled, error: "", pendingIds: [] });
    }

    useEffect(() => {
        const update = () => setGuestIds(readGuestLikes());
        const storage = (event) => { if (event.key === GUEST_LIKES_KEY || event.key === null) update(); };
        window.addEventListener(GUEST_LIKES_CHANGED, update);
        window.addEventListener("storage", storage);
        return () => {
            window.removeEventListener(GUEST_LIKES_CHANGED, update);
            window.removeEventListener("storage", storage);
        };
    }, []);

    useEffect(() => {
        let active = true;
        currentOwner.current = ownerKey;
        const token = getSessionToken();
        if (enabled) {
            const key = ownerKey + ":" + refreshVersion;
            // Reuse the job during Strict Mode's effect replay; serialize account changes.
            if (sync.current?.key !== key) {
                const previous = sync.current?.merge;
                const config = { sessionToken: token };
                const merge = (async () => {
                    await previous?.catch(() => {});
                    if (token !== getSessionToken()) throw new Error("Your account changed. Please try again.");
                    await mergeGuestLikes(config);
                })();
                const promise = merge.then(() => getLikes(config));
                sync.current = { key, merge, promise };
            }
            sync.current.promise.then((products) => {
                if (active && token === getSessionToken()) {
                    setAccount(current => current.ownerKey === ownerKey
                        ? { ...current, products, loading: false, error: "" } : current);
                }
            }).catch((failure) => {
                if (active && token === getSessionToken()) {
                    const error = failure.response?.data?.message || "Unable to sync your likes. Please try again.";
                    setAccount(current => current.ownerKey === ownerKey ? { ...current, loading: false, error } : current);
                }
            });
        }
        return () => { active = false; currentOwner.current = null; };
    }, [enabled, ownerKey, refreshVersion]);

    async function toggleLike(product) {
        if (authLoading) throw new Error("Please wait while we check your session.");
        if (!user) { toggleGuestLike(product.id); return; }
        const token = getSessionToken();
        if (!token) throw new Error("Please log in again to update your likes.");
        if (account.loading) throw new Error("Your likes are loading. Please try again.");
        const key = ownerKey + ":" + product.id;
        if (pending.current.has(key)) return;
        const operation = {};
        pending.current.set(key, operation);
        setAccount(current => ({ ...current, pendingIds: [...current.pendingIds, product.id] }));
        const liked = account.products.some(item => item.id === product.id);
        try {
            const config = { sessionToken: token };
            const saved = liked ? await unlikeProduct(product.id, config) : await likeProduct(product.id, config);
            if (currentOwner.current !== ownerKey || token !== getSessionToken()) throw new Error("Your account changed. Please try again.");
            setAccount(current => current.ownerKey === ownerKey ? { ...current, products: liked
                ? current.products.filter(item => item.id !== product.id)
                : [...current.products.filter(item => item.id !== product.id), saved] } : current);
        } finally {
            if (pending.current.get(key) === operation) pending.current.delete(key);
            if (currentOwner.current === ownerKey) {
                setAccount(current => current.ownerKey === ownerKey
                    ? { ...current, pendingIds: current.pendingIds.filter(id => id !== product.id) } : current);
            }
        }
    }

    function refreshLikes() {
        if (!enabled || [...pending.current.keys()].some(key => key.startsWith(ownerKey + ":"))) return;
        setAccount(current => ({ ...current, loading: true, error: "" }));
        setRefreshVersion(version => version + 1);
    }

    const likedIds = enabled ? account.products.map(product => product.id) : guestIds;
    return <LikesContext.Provider value={{ likedIds, isLiked: id => likedIds.includes(id), toggleLike,
        loading: authLoading || (enabled && account.loading), pendingIds: account.pendingIds,
        error: enabled ? account.error : "", refreshLikes }}>{children}</LikesContext.Provider>;
}
