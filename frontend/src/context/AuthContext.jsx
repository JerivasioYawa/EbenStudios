import { useEffect, useRef, useState } from "react";
import AuthContext from "./auth-context";
import { login as apiLogin, register as apiRegister, getCurrentUser } from "../service/authService";
import { clearSession, getSessionToken, saveSessionToken, SESSION_CHANGED, SESSION_EXPIRED_MESSAGE, TOKEN_KEY } from "../service/session";

export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => ({ user: null, loading: Boolean(getSessionToken()), sessionError: "", sessionId: 0 }));
    const operation = useRef(0);

    useEffect(() => {
        let active = true;
        localStorage.removeItem("eben_cart_items");

        async function restore(token) {
            try {
                const user = await getCurrentUser({ sessionToken: token });
                if (active && token === getSessionToken()) {
                    setSession((current) => ({ user, loading: false, sessionError: "", sessionId: current.sessionId + 1 }));
                }
            } catch {
                if (active && token === getSessionToken()) {
                    setSession((current) => ({ user: null, loading: false, sessionId: current.sessionId + 1,
                        sessionError: "Unable to verify your session. Please log in again." }));
                }
            }
        }

        function onSessionChanged(event) {
            operation.current++;
            setSession((current) => ({ user: null, loading: false, sessionId: current.sessionId + 1,
                sessionError: event.detail?.reason === "expired" ? SESSION_EXPIRED_MESSAGE : "" }));
        }

        function onStorage(event) {
            if (event.key !== TOKEN_KEY && event.key !== null) return;
            operation.current++;
            const token = getSessionToken();
            setSession((current) => ({ user: null, loading: Boolean(token), sessionError: "", sessionId: current.sessionId + 1 }));
            if (token) void restore(token);
        }

        window.addEventListener(SESSION_CHANGED, onSessionChanged);
        window.addEventListener("storage", onStorage);
        const token = getSessionToken();
        if (token) void restore(token);
        return () => {
            active = false;
            window.removeEventListener(SESSION_CHANGED, onSessionChanged);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    async function authenticate(action) {
        const currentOperation = ++operation.current;
        const { user, token } = await action();
        if (currentOperation !== operation.current) throw new Error("Sign-in was cancelled. Please try again.");
        saveSessionToken(token);
        setSession((current) => ({ user, loading: false, sessionError: "", sessionId: current.sessionId + 1 }));
        return user;
    }

    function login(email, password) {
        return authenticate(() => apiLogin(email, password));
    }

    function register(name, email, password) {
        return authenticate(() => apiRegister(name, email, password));
    }

    function logout() {
        clearSession();
    }

    return (
        <AuthContext.Provider value={{ ...session, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
