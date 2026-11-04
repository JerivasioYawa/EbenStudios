import AppRoutes from "./routes/AppRoutes";
import SessionBoundary from "./routes/SessionBoundary";

export default function App() {
    return <SessionBoundary><AppRoutes /></SessionBoundary>;
}
