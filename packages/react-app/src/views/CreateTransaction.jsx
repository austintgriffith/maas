import React, { useEffect, useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Button, Input, Select, InputNumber, Space, Tooltip, Alert } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { AddressInput, EtherInput, WalletConnectInput, IFrame } from "../components";
import TransactionDetailsModal from "../components/MultiSig/TransactionDetailsModal";
import { parseExternalContractTransaction } from "../helpers";
import { useLocalStorage } from "../hooks";
import { ethers } from "ethers";
import { parseEther } from "@ethersproject/units";
const { Option } = Select;

const axios = require("axios");

export default function CreateTransaction({
  poolServerUrl,
  contractName,
  contractAddress,
  mainnetProvider,
  localProvider,
  price,
  readContracts,
  userSigner,
  nonce,
  signaturesRequired,
}) {
  const history = useHistory();

  const [methodName, setMethodName] = useLocalStorage("methodName", "transferFunds");
  const [newSignaturesRequired, setNewSignaturesRequired] = useState(signaturesRequired);
  const [amount, setAmount] = useState("0");
  const [to, setTo] = useLocalStorage("to");
  const [customCallData, setCustomCallData] = useState("");
  const [parsedCustomCallData, setParsedCustomCallData] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shouldCreateTransaction, setShouldCreateTransaction] = useState(false);
  const [isOwner, setIsOwner] = useState();

  const [hasEdited, setHasEdited] = useState(); //we want the signaturesRequired to update from the contract _until_ they edit it

  useEffect(() => {
    if (!hasEdited) {
      setNewSignaturesRequired(signaturesRequired);
    }
  }, [signaturesRequired]);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const inputStyle = {
    padding: 10,
  };

  useEffect(() => {
    const getParsedTransaction = async () => {
      const parsedTransaction = await parseExternalContractTransaction(to, customCallData);
      setParsedCustomCallData(parsedTransaction);
    };

    getParsedTransaction();
  }, [customCallData]);

  const loadTransactionData = ({ to, value, data }) => {
    setTo(to);
    value ? setAmount(ethers.utils.formatEther(value)) : setAmount("0");
    setCustomCallData(data);
    setShouldCreateTransaction(true);
  };

  useEffect(() => {
    shouldCreateTransaction && createTransaction();
    setShouldCreateTransaction(false);
  }, [shouldCreateTransaction]);

  const createTransaction = async () => {
    console.log("n-createTransaction: ");
    try {
      //a little security in the frontend just because
      if (newSignaturesRequired < 1) {
        alert("signatures required must be >= 1");
      } else {
        setLoading(true);
        console.log("n-on else block");
        console.log("n-methodName: ", methodName);

        let callData;
        let executeToAddress;
        if (
          methodName == "transferFunds" ||
          methodName == "customCallData" ||
          methodName == "wcCallData" ||
          methodName === "iframeCallData"
        ) {
          callData = methodName == "transferFunds" ? "0x" : customCallData;
          executeToAddress = to;
        } else {
          callData = readContracts[contractName]?.interface?.encodeFunctionData(methodName, [
            to,
            newSignaturesRequired,
          ]);
          executeToAddress = contractAddress;
        }
        console.log("n-callData: ", callData);
        console.log("n-executeToAddress: ", executeToAddress);
        console.log("n-nonce.toNumber(): ", nonce.toNumber());

        const newHash = await readContracts[contractName].getTransactionHash(
          nonce.toNumber(),
          executeToAddress,
          parseEther("" + parseFloat(amount).toFixed(12)),
          callData,
        );

        console.log("n-readContracts: ", readContracts);
        console.log("n-newHash: ", newHash);
        console.log("n-userSigner: ", userSigner);

        const signature = await userSigner?.signMessage(ethers.utils.arrayify(newHash));
        console.log("signature: ", signature);
        console.log("n-signature: ", signature);

        const recover = await readContracts[contractName].recover(newHash, signature);
        console.log("recover: ", recover);
        console.log("n-recover: ", recover);

        const isOwner = await readContracts[contractName].isOwner(recover);
        console.log("n-isOwner: ", isOwner);
        setIsOwner(isOwner);

        console.log("isOwner: ", isOwner);

        if (isOwner) {
          const res = await axios.post(poolServerUrl, {
            chainId: localProvider._network.chainId,
            address: readContracts[contractName]?.address,
            nonce: nonce.toNumber(),
            to: executeToAddress,
            amount,
            data: callData,
            hash: newHash,
            signatures: [signature],
            signers: [recover],
          });

          console.log("RESULT", res.data);
          setTimeout(() => {
            history.push("/pool");
            setLoading(false);
          }, 1000);
        } else {
          console.log("ERROR, NOT OWNER.");
          setLoading(false);
        }
      }
    } catch (error) {
      console.log("n-Error: ", error);
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center flex-col items-center ">
      <div
        // style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}
        className={`flex justify-center border-2 m-5 rounded-2xl shadow-md ${
          methodName === "iframeCallData" && "w-2/3"
        }`}
        style={{
          minWidth: "24rem",
          // width: methodName === "iframeCallData" && 700,
        }}
      >
        <div className="flex flex-col items-center w-full" style={{ margin: 8 }}>
          <div style={{ margin: 8, padding: 8, width: "10rem", maxWidth: "15rem" }}>
            <Select value={methodName} style={{ width: "100%" }} onChange={setMethodName}>
              <Option key="transferFunds">Send ETH</Option>
              <Option key="addSigner">Add Signer</Option>
              <Option key="removeSigner">Remove Signer</Option>
              <Option key="customCallData">Custom Call Data</Option>
              <Option key="wcCallData">
                {/* <img src="walletconnect-logo.svg" style={{ height: 20, width: 20 }} /> WalletConnect */}
                WalletConnect
              </Option>
              <Option key="iframeCallData">IFrame</Option>
            </Select>
          </div>
          {methodName === "wcCallData" ? (
            <div style={inputStyle}>
              <WalletConnectInput
                chainId={localProvider?._network.chainId}
                address={contractAddress}
                loadTransactionData={loadTransactionData}
                mainnetProvider={mainnetProvider}
                price={price}
              />
            </div>
          ) : methodName === "iframeCallData" ? (
            <IFrame
              address={contractAddress}
              loadTransactionData={loadTransactionData}
              mainnetProvider={mainnetProvider}
              price={price}
            />
          ) : (
            <>
              <div style={inputStyle}>
                <AddressInput
                  autoFocus
                  ensProvider={mainnetProvider}
                  placeholder={methodName == "transferFunds" ? "Recepient address" : "Owner address"}
                  value={to}
                  onChange={setTo}
                />
              </div>
              <div style={inputStyle}>
                {(methodName == "addSigner" || methodName == "removeSigner") && (
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="New # of signatures required"
                    value={newSignaturesRequired}
                    onChange={value => {
                      setNewSignaturesRequired(value);
                      setHasEdited(true);
                    }}
                  />
                )}
                {methodName == "customCallData" && (
                  <>
                    <Input.Group compact>
                      <Input
                        style={{ width: "calc(100% - 31px)", marginBottom: 20 }}
                        placeholder="Custom call data"
                        value={customCallData}
                        onChange={e => {
                          setCustomCallData(e.target.value);
                        }}
                      />
                      <Tooltip title="Parse transaction data">
                        <Button onClick={showModal} icon={<CodeOutlined />} />
                      </Tooltip>
                    </Input.Group>
                    <TransactionDetailsModal
                      visible={isModalVisible}
                      txnInfo={parsedCustomCallData}
                      handleOk={() => setIsModalVisible(false)}
                      handleCancel={() => setIsModalVisible(false)}
                      mainnetProvider={mainnetProvider}
                      price={price}
                    />
                  </>
                )}
                {(methodName == "transferFunds" || methodName == "customCallData") && (
                  <EtherInput price={price} mode="USD" value={amount} onChange={setAmount} />
                )}
              </div>
              <Space style={{ marginTop: 32 }}>
                <Button loading={loading} onClick={createTransaction} type="primary">
                  Propose
                </Button>
              </Space>
            </>
          )}
        </div>
      </div>

      {isOwner === false && <Alert message="you are not the owner ! " type="error" showIcon />}
    </div>
  );
}
