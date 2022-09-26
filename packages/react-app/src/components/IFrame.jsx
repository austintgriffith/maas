import React, { useState, useEffect } from "react";
import { Input, Button, Spin, Row, Col, Select } from "antd";
import { useSafeInject } from "../contexts/SafeInjectContext";
import TransactionDetailsModal from "./MultiSig/TransactionDetailsModal";
import { NETWORKS } from "../constants";
import { parseExternalContractTransaction } from "../helpers";

const { Option } = Select;

export default function IFrame({ address, loadTransactionData, mainnetProvider, price }) {
  const cachedNetwork = window.localStorage.getItem("network");
  let targetNetwork = NETWORKS[cachedNetwork || "mainnet"];

  const { setAddress, appUrl, setAppUrl, setRpcUrl, iframeRef, newTx, setNewTx } = useSafeInject();

  const [isIFrameLoading, setIsIFrameLoading] = useState(false);
  const [inputAppUrl, setInputAppUrl] = useState();
  const [tx, setTx] = useState();
  const [parsedTransactionData, setParsedTransactionData] = useState();
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    setAddress(address);
    setRpcUrl(targetNetwork.rpcUrl);
  }, []);

  useEffect(() => {
    if (newTx) {
      setTx(newTx);
    }
  }, [newTx]);

  useEffect(() => {
    if (tx) {
      decodeFunctionData();
    }
  }, [tx]);

  const decodeFunctionData = async () => {
    try {
      const parsedTransactionData = await parseExternalContractTransaction(tx.to, tx.data);
      setParsedTransactionData(parsedTransactionData);
      setIsModalVisible(true);
    } catch (error) {
      console.log(error);
      setParsedTransactionData(null);
    }
  };

  const hideModal = () => setIsModalVisible(false);

  const handleOk = () => {
    loadTransactionData({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });
    setNewTx(false);
  };

  const iframApps = [
    {
      name: "ens",
      url: "https://app.ens.domains",
    },
    {
      name: "uniswap",
      url: "https://app.uniswap.org",
    },
    {
      name: "0xsplits",
      url: "https://app.0xsplits.xyz",
    },
    {
      name: "aave",
      url: "https://app.aave.com",
    },
    {
      name: "snapshot",
      url: "https://snapshot.org",
    },

    {
      name: "instadapp",
      url: "https://defi.instadapp.io",
    },

    {
      name: "hop",
      url: "https://app.hop.exchange",
    },

    {
      name: "balancer",
      url: "https://app.balancer.fi",
    },

    {
      name: "pooltogether",
      url: "https://cloudflare-ipfs.com/ipfs/QmTa21pi77hiT1sLCGy5BeVwcyzExUSp2z7byxZukye8hr",
    },

    {
      name: "juicebox",
      url: "https://www.juicebox.money",
    },

    {
      name: "rocketpool",
      url: "https://stake.rocketpool.net/gnosis",
    },

    {
      name: "zerion",
      url: "https://app.zerion.io",
    },
  ];

  const handleChangeApp = url => {
    console.log(`selected app url ${url}`);
    setAppUrl(url);
    setIsIFrameLoading(true);
  };
  return (
    <div className="flex flex-col items-center">
      <Select placeholder="Select App" className="w-36" onChange={handleChangeApp}>
        {iframApps.map((app, index) => (
          <React.Fragment key={index}>
            <Option value={app.url}>{app.name.toUpperCase()}</Option>
          </React.Fragment>
        ))}
      </Select>

      <Input
        placeholder="custom dapp URL"
        style={{
          marginTop: 32,
          minWidth: "18rem",
          maxWidth: "20rem",
        }}
        autoFocus={true}
        value={inputAppUrl}
        onChange={e => setInputAppUrl(e.target.value)}
      />
      <Button
        type={"primary"}
        style={{
          marginTop: "1rem",
          maxWidth: "8rem",
        }}
        onClick={() => {
          setAppUrl(inputAppUrl);
          setIsIFrameLoading(true);
        }}
      >
        {isIFrameLoading ? <Spin /> : "Load"}
      </Button>
      {appUrl && (
        <iframe
          title="app"
          src={appUrl}
          width="1200rem"
          height="900rem"
          style={{
            marginTop: "1rem",
          }}
          ref={iframeRef}
          onLoad={() => setIsIFrameLoading(false)}
        />
      )}
      {isModalVisible && (
        <TransactionDetailsModal
          visible={isModalVisible}
          txnInfo={parsedTransactionData}
          handleOk={handleOk}
          handleCancel={hideModal}
          showFooter={true}
          mainnetProvider={mainnetProvider}
          price={price}
          to={tx.to}
          value={tx.value}
          type="IFrame"
        />
      )}
    </div>
  );
}
