import { createContext, useContext } from "react";
export const PeersContext = createContext();
export const usePeers = () => useContext(PeersContext);
