import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { LikesProvider } from "./context/LikesContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <LikesProvider>
                    <CartProvider>
                        <App />
                    </CartProvider>
                </LikesProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
