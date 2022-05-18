import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";
//inspo from https://github.com/madou/react-peer

/**
 * Receive changes to state from peers
 */
export const useReceivePeerState = ({ peerBrokerIds, client }) => {
  const [state, setState] = useState();
  const [isConnected, setIsConnected] = useState({});

  useEffect(() => {
    if (!peerBrokerIds?.length) {
      return;
    }

    if (!client) {
      return;
    }

    console.log(`P2P: Connecting to peers: ${peerBrokerIds}`);

    for (const id of peerBrokerIds) {
      console.log(`P2P: Connecting to peer: ${id}`);
      const connection = client.connect(id);

      connection.on("open", () => {
        console.log(`P2P: Connected to ${id}`);
        connection.on("data", receivedData => {
          console.log(`P2P: Received data from ${id}`, receivedData);
          setState(prevState => ({ ...prevState, [id]: receivedData }));
          setIsConnected(prevState => ({ ...prevState, [id]: true }));
        });
      });

      connection.on("close", () => {
        console.log(`P2P: Connection to ${id} closed`);
        setIsConnected(prevState => ({ ...prevState, [id]: false }));
      });

      connection.on("error", err => console.error(`P2P: Error from ${id}`, err));
    }

    return () => {
      setIsConnected({});
    };
  }, [JSON.stringify(peerBrokerIds), client]);

  return [state, isConnected];
};

/**
 * Sends our state to our peers
 */
export const usePeerState = ({ initialState, client }) => {
  const [connections, setConnections] = useState([]);
  const [state, setState] = useState(initialState);
  // We useRef to get around useLayoutEffect's closure only having access
  // to the initial state since we only re-execute it if brokerId changes.
  const stateRef = useRef(initialState);

  useEffect(() => {
    if (!client) {
      return;
    }
    client.on("error", err => console.log(`P2P: Error`, err));

    client.on("connection", conn => {
      setConnections(prevState => [...prevState, conn]);

      // We want to immediately send the newly connected peer the current data.
      conn.on("open", () => {
        console.log(`P2P: Connection from ${conn.peer}, sending state`);
        conn.send(stateRef.current);
      });
    });
  }, [client]);

  return [
    state,
    newState => {
      setState(newState);
      stateRef.current = newState;
      connections.forEach(conn => conn.send(newState));
    },
    connections,
  ];
};

export const useP2P = ({ contractAddress, address }) => {
  const [peer, setPeer] = useState(undefined);
  useEffect(() => {
    if (contractAddress && address) {
      const brokerId = `${contractAddress}-${address}`;
      console.log(`P2P: Connecting as ${brokerId}`);

      const localPeer = new Peer(brokerId);
      localPeer.on("error", err => console.error(`P2P: Error`, err));
      localPeer.on("open", () => {
        console.log(`P2P: Open`);
        setPeer(localPeer);
      });
      return () => {
        console.log(`P2P: Destroying`);
        localPeer?.destroy();
      };
    }
  }, [contractAddress, address]);

  return peer;
};
