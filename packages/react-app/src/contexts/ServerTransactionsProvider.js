import axios from "axios";
import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { TransactionContext } from "./TransactionContext";

/**
 * Uses a remote server to store transactions
 */
export const ServerTransactionsProvider = ({ serverUrl, chainId, contractAddress, children }) => {
  // Stale-While- Revalidate provides a way to refresh remote data in a local cache and
  // control how it is refreshed. This enables polling refresh as well as the standard triggers
  const getUrl = serverUrl + contractAddress + "_" + chainId;
  const { data: transactions } = useSWR(
    getUrl,
    async url => {
      const { data } = await axios.get(url);
      return data;
    },
    { refreshInterval: 3777 },
  );

  const saveTransaction = useCallback(
    async tx => {
      await axios.post(serverUrl, tx);
      await mutate(getUrl);
    },
    [getUrl, serverUrl],
  );

  const value = {
    unvalidatedTransactions: transactions,
    saveTransaction,
  };

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
};
