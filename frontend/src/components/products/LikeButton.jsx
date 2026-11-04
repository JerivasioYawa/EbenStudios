import { useState } from "react";
import { Heart } from "lucide-react";
import { useLikes } from "../../hooks/useLikes";

export default function LikeButton({ product, className = "" }) {
    const { isLiked, toggleLike, loading, pendingIds } = useLikes();
    const [error, setError] = useState("");
    const liked = isLiked(product.id);
    const busy = pendingIds.includes(product.id);

    async function toggle() {
        setError("");
        try { await toggleLike(product); }
        catch (failure) { setError(failure.response?.data?.message || failure.message || "Unable to update this like."); }
    }

    return <div className={className}>
        <button type="button" aria-label={`Like ${product.name}`} aria-pressed={liked}
            aria-busy={busy} disabled={loading || busy} title={liked ? "Remove from likes" : "Save to likes"}
            onClick={toggle}
            className={`flex items-center justify-center rounded-full border border-black/10 bg-white p-3 shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black disabled:opacity-50 ${liked ? "text-red-600" : "text-neutral-600 hover:text-red-600"}`}>
            <Heart size={20} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
        </button>
        {error && <p role="alert" className="mt-2 max-w-56 text-sm text-red-600">{error}</p>}
    </div>;
}
