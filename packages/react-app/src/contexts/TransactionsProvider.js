import { P2PTransactionsProvider } from "./P2PTransactionsProvider";
import { ServerTransactionsProvider } from "./ServerTransactionsProvider";

export const TransactionsProvider = ({ providerType, providerOptions, children }) => {
  if (providerType === "p2p") {
    return <P2PTransactionsProvider {...providerOptions}>{children}</P2PTransactionsProvider>;
  }

  if (providerType === "server") {
    return <ServerTransactionsProvider {...providerOptions}>{children}</ServerTransactionsProvider>;
  }

  console.warn(`Unknown transactions provider ${providerType}`);
  return children;
};
