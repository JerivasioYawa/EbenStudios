import { useEffect, useState } from "react";

export function useAdminQuery(fetcher, params, revision = 0) {
    const query = JSON.stringify(params), key = query + ":" + revision;
    const [result, setResult] = useState({ key: null, data: null, error: "" });
    useEffect(() => {
        const controller = new AbortController();
        fetcher(JSON.parse(query), { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted) setResult({ key, data, error: "" }); })
            .catch(error => {
                if (!controller.signal.aborted) setResult({ key, data: null, error: error.response?.data?.message || "Unable to load these records. Please try again." });
            });
        return () => controller.abort();
    }, [fetcher, query, key]);
    return result.key === key ? { data: result.data, error: result.error, loading: false } : { data: null, error: "", loading: true };
}
