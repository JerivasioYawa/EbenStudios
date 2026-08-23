import { useEffect, useState } from "react";
import AuthContext from "./auth-context";
import { login as apiLogin, register as apiRegister, getCurrentUser } from "../service/authService";

const TOKEN_KEY = "eben_auth_token";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

    useEffect(() => {
        if (!localStorage.getItem(TOKEN_KEY)) {
            return;
        }

        getCurrentUser()
            .then(setUser)
            .catch(() => localStorage.removeItem(TOKEN_KEY))
            .finally(() => setLoading(false));
    }, []);

    async function login(email, password) {
        const { user: loggedInUser, token } = await apiLogin(email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser(loggedInUser);
        return loggedInUser;
    }

    async function register(name, email, password) {
        const { user: newUser, token } = await apiRegister(name, email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser(newUser);
        return newUser;
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
