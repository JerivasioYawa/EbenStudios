import { useContext } from "react";
import LikesContext from "../context/likes-context";

export function useLikes() {
    return useContext(LikesContext);
}
