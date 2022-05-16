import axios from "axios";
import { createContext, useCallback, useContext } from "react";
import useSWR, { mutate } from "swr";

export const TransactionContext = createContext();

export const ServerBasedTransactionsProvider = ({ url, children }) => {
  // STale While Revalidate provides a way to refresh remote data in a local cache and
  // control how it is refreshed. This enables polling refresh as well as the standard triggers
  const { data: transactions } = useSWR(
    url,
    async () => {
      const { data } = await axios.get(url);
      return data;
    },
    { refreshInterval: 3777 },
  );

  const saveTransactions = useCallback(
    async newTransactions => {
      await axios.post(url, newTransactions);
      await mutate(url);
    },
    [url],
  );

  const value = {
    unvalidatedTransactions: transactions,
    saveTransactions,
  };

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
};
export const useTransactions = () => useContext(TransactionContext);
