import { useCallback, useEffect } from "react";
import { useP2P, useReceivePeerState, usePeerState, useOwners } from "../hooks";
import { PeersContext } from "./PeersContext";
import { TransactionContext } from "./TransactionContext";

/**
 * Uses peer to peer connections to share transactions.
 * uses peerjs public servers for ICE/STUN/TURN servers for finding each other.
 */
export const P2PTransactionsProvider = ({ address, contractAddress, ownerEvents, children }) => {
  const storageKey = `txns-${contractAddress}`;
  const { owners } = useOwners({ ownerEvents });
  const peerIds = owners?.filter(o => o !== address).map(ownerAddress => `${contractAddress}-${ownerAddress}`);
  const client = useP2P({ contractAddress, address });

  // used to receive peer changes, object keyed by peerId with their state
  const [peerState, isConnected] = useReceivePeerState({ peerBrokerIds: peerIds, client });

  // Used to broadcast our state changes
  const [state, setState, connections] = usePeerState({
    initialState: JSON.parse(localStorage.getItem(storageKey) || "{}"),
    client,
  });

  const saveTransactions = useCallback(
    txs => {
      setState(txs);
      localStorage.setItem(storageKey, JSON.stringify(txs));
    },
    [setState, storageKey],
  );

  /**
   * The server based provider saves 1 tx at a time.
   * P2P easiest implemtation is sharing entire state. Could move this to be messages based and align the two.
   */
  const saveTransaction = useCallback(
    tx => {
      console.log("P2P: Saving TX", tx);
      const newState = { ...state, [tx.hash]: tx };
      saveTransactions(newState);
    },
    [saveTransactions, JSON.stringify(state)],
  );

  useEffect(() => {
    if (!peerState) {
      return;
    }
    console.log(`P2P: Merging State`, { state, peerState });
    // Naive sync merge
    let changed = false;
    for (const peerTxs of Object.values(peerState)) {
      for (const [id, tx] of Object.entries(peerTxs)) {
        if (!state[id]) {
          state[id] = tx;
          changed = true;
        } else {
          for (const signature of Object.values(tx.signatures)) {
            if (!state[id].signatures[signature.signer]) {
              state[id].signatures[signature.signer] = signature;
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      console.log(`P2P: State updated from peer`, state);
      saveTransactions(state);
    } else {
      console.log("P2P: No changes merged");
    }
  }, [JSON.stringify(peerState), JSON.stringify(state)]);

  const peers = Object.fromEntries(
    peerIds.map(id => {
      return [id.split("-")[1], Boolean(isConnected?.[id] || connections.find(c => c.peer === id))];
    }),
  );
  const value = {
    unvalidatedTransactions: Object.values(state),
    saveTransaction,
  };

  return (
    <PeersContext.Provider value={peers}>
      <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>
    </PeersContext.Provider>
  );
};
