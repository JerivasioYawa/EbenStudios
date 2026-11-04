export const fieldClass = "border border-black/15 rounded-xl px-4 py-3 bg-white w-full";
export const actionClass = "border border-black/15 rounded-full px-4 py-2 font-semibold text-sm hover:bg-neutral-100 disabled:opacity-50";

export function Pagination({ page, totalPages, total, onChange, disabled = false }) {
    return <nav aria-label="Pagination" className="flex flex-wrap items-center gap-4 my-5 text-sm">
        <button className={actionClass} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages} · {total} records</span>
        <button className={actionClass} disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>;
}

export function QueryState({ loading, error, retry }) {
    if (loading) return <p role="status" className="py-6">Loading records...</p>;
    if (error) return <div role="alert" className="py-4 text-red-700">{error} <button className={actionClass} onClick={retry}>Try Again</button></div>;
    return null;
}
