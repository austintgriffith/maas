import React, { useState, useEffect, useMemo } from "react";
import { Button, Modal, InputNumber, Alert } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { ethers } from "ethers";
import { Input } from "antd";
import { hexZeroPad, hexlify } from "@ethersproject/bytes";
import axios from "axios";

import { AddressInput, EtherInput, Address } from "..";
import CreateModalSentOverlay from "./CreateModalSentOverlay";

const DEBUG = false;

function CreateMultiSigModal({
  price,
  selectedChainId,
  mainnetProvider,
  address,
  tx,
  writeContracts,
  contractName,
  isCreateModalVisible,
  setIsCreateModalVisible,
  poolServerUrl,
  reDeployWallet,
  getUserWallets,
  setReDeployWallet,
  currentNetworkName,

  isFactoryDeployed,
}) {
  const [deployType, setDeployType] = useState("CREATE");
  const [pendingCreate, setPendingCreate] = useState(false);
  const [txSent, setTxSent] = useState(false);
  const [txError, setTxError] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  const [signaturesRequired, setSignaturesRequired] = useState(undefined);
  const [amount, setAmount] = useState("0");
  const [owners, setOwners] = useState([""]);
  const [walletName, setWalletName] = useState("");
  const [preComputedAddress, setPreComputedAddress] = useState("");
  const [isWalletExist, setIsWalletExist] = useState(false);

  useEffect(() => {
    if (address) {
      setOwners([...new Set([address])]);
    }
  }, [address]);

  const showCreateModal = async deployType => {
    if (deployType === "CREATE") {
      setDeployType("CREATE");
      // setOwners([...new Set([address])]);
      setTimeout(() => {
        setIsCreateModalVisible(true);
      }, 100);
    }

    if (deployType === "RE_DEPLOY") {
      // on redploy get previous data in states
      let prevSignaturesRequired = reDeployWallet ? reDeployWallet["signaturesRequired"] : 0;
      let prevOwners = reDeployWallet ? reDeployWallet["owners"] : [];

      let prevWalletName = reDeployWallet["walletName"];

      let computed_wallet_address = await writeContracts[contractName].computedAddress(prevWalletName);

      setDeployType("RE_DEPLOY");
      setSignaturesRequired(prevSignaturesRequired);
      setOwners([...new Set([...prevOwners, address])]);
      setPreComputedAddress(computed_wallet_address);

      setTimeout(() => {
        setIsCreateModalVisible(true);
      }, 100);
    }
  };

  const handleCancel = () => {
    // setWalletName("");
    setIsCreateModalVisible(false);
    getUserWallets();
    setIsWalletExist(false);
  };

  const addOwnerField = () => {
    const newOwners = [...owners, ""];
    setOwners(newOwners);
  };

  const removeOwnerField = index => {
    const newOwners = [...owners];
    newOwners.splice(index, 1);
    setOwners(newOwners);
  };

  const updateOwner = (value, index) => {
    // for a single addresss
    if (value.length <= 42) {
      const newOwners = [...owners];
      newOwners[index] = value;
      setOwners(newOwners);
    }

    // if value is multiple addresses with comma
    if (value.length > 42) {
      addMultipleAddress(value);
    }
  };

  const addMultipleAddress = value => {
    // add basic validation a address should contains 0x with length of 42 chars
    const validateAddress = address => address.includes("0x") && address.length === 42;

    const addresses = value.trim().split(",");
    let uniqueAddresses = [...new Set([...addresses])];

    uniqueAddresses = uniqueAddresses.filter(validateAddress);

    let finalUniqueAddresses = [...new Set([...owners.filter(validateAddress), ...uniqueAddresses])];
    setOwners(finalUniqueAddresses);
  };

  const validateFields = () => {
    let valid = true;

    if (signaturesRequired > owners.length) {
      console.log("Validation error: signaturesRequired is greather than number of owners.");
      valid = false;
    }

    owners.forEach((owner, index) => {
      let err;
      if (!owner) {
        err = "Required Input";
      } else if (owners.slice(0, index).some(o => o === owner)) {
        err = "Duplicate Owner";
      } else if (!ethers.utils.isAddress(owner)) {
        err = "Bad format";
      }

      if (err) {
        console.log("Owners field error: ", err);
        valid = false;
      }
    });

    return valid;
  };

  const resetState = () => {
    setWalletName("");
    setPendingCreate(false);
    setTxSent(false);
    setTxError(false);
    setTxSuccess(false);
    setOwners([""]);
    setAmount("0");
    setSignaturesRequired(false);
    setIsWalletExist(false);
    setPreComputedAddress("");
  };

  const handleSubmit = () => {
    try {
      setPendingCreate(true);

      if (!validateFields()) {
        setPendingCreate(false);
        throw "Field validation failed.";
      }
      let currentWalletName = deployType === "CREATE" ? walletName : reDeployWallet["walletName"];
      // const id = ethers.utils.id(currentWalletName);
      // const id = ethers.utils.id(String(address) + currentWalletName);
      // const hash = ethers.utils.keccak256(id);
      // const salt = hexZeroPad(hexlify(hash), 32);

      tx(
        // old create
        // writeContracts[contractName].create(selectedChainId, owners, signaturesRequired, {
        //   value: ethers.utils.parseEther("" + parseFloat(amount).toFixed(12)),
        // }
        // create 2
        writeContracts[contractName].create2(owners, signaturesRequired, currentWalletName, {
          value: ethers.utils.parseEther("" + parseFloat(amount).toFixed(12)),
        }),
        async update => {
          if (update && (update.error || update.reason)) {
            console.log("tx update error!");
            setPendingCreate(false);
            setTxError(true);
          }

          if (update && update.code) {
            setPendingCreate(false);
            setTxSent(false);
          }

          if (update && (update.status === "confirmed" || update.status === 1)) {
            console.log("tx update confirmed!");
            // setPendingCreate(false);
            // setTxSuccess(true);
            // setTimeout(() => {
            //   setIsCreateModalVisible(false);
            //   resetState();
            // }, 2500);

            let computed_wallet_address = await writeContracts[contractName].computedAddress(
              // selectedChainId,
              // owners,
              // signaturesRequired,
              // salt,
              currentWalletName,
            );

            let walletAddress = deployType === "CREATE" ? computed_wallet_address : reDeployWallet["walletAddress"];

            if (deployType === "CREATE") {
              let reqData = {
                owners,
                signaturesRequired,
              };

              console.log("n-reqData: ", reqData);
              const res = await axios.post(
                poolServerUrl + `createWallet/${address}/${walletName}/${walletAddress}/${selectedChainId}`,
                reqData,
              );

              let data = res.data;
              console.log("create wallet res data: ", data);

              setPendingCreate(false);
              setTxSuccess(true);
              // setTimeout(() => {
              //   setIsCreateModalVisible(false);
              // resetState();
              // }, 2500);

              // window.location.reload();
              resetState();
            }

            if (deployType === "RE_DEPLOY") {
              // const res = await axios.get(poolServerUrl + `updateChainId/${address}/${walletAddress}/${selectedChainId}`);
              const res = await axios.get(
                poolServerUrl + `updateChainId/${address}/${walletAddress}/${selectedChainId}`,
              );
              let data = res.data;

              console.log("update chain res data: ", data);
              setReDeployWallet(undefined);
              window.location.reload();
            }

            resetState();
            await getUserWallets(true);
          }
        },
      ).catch(err => {
        setPendingCreate(false);
        throw err;
      });

      setTxSent(true);
    } catch (e) {
      console.log("CREATE MUTLI-SIG SUBMIT FAILED: ", e);
    }
  };

  const checkWalletExist = async () => {
    let currentWalletName = deployType === "CREATE" ? walletName : reDeployWallet["walletName"];
    // const id = ethers.utils.id(String(address) + currentWalletName);
    // const hash = ethers.utils.keccak256(id);
    // const salt = hexZeroPad(hexlify(hash), 32);

    let computed_wallet_address = await writeContracts[contractName].computedAddress(currentWalletName);

    let isContractExists = await writeContracts[contractName].provider.getCode(computed_wallet_address);

    if (isContractExists !== "0x") {
      setIsWalletExist(true);
    }

    if (isContractExists === "0x") {
      setIsWalletExist(false);
    }
  };

  const onInputWalletName = async walletName => {
    setWalletName(walletName);
    let currentWalletName = walletName;
    // const id = ethers.utils.id(String(address) + currentWalletName);
    // const hash = ethers.utils.keccak256(id);
    // const salt = hexZeroPad(hexlify(hash), 32);

    let computed_wallet_address = await writeContracts[contractName].computedAddress(currentWalletName);
    setPreComputedAddress(computed_wallet_address);
  };

  return (
    <>
      <Button
        type="primary"
        onClick={() => showCreateModal("CREATE")}
        className="mx-2"
        disabled={isFactoryDeployed === undefined}
      >
        Create
      </Button>

      {reDeployWallet !== undefined && (
        <Button type="primary" onClick={() => showCreateModal("RE_DEPLOY")} ghost className="mx-2">
          Deploy {reDeployWallet["walletName"]} to {currentNetworkName}
        </Button>
      )}

      <Modal
        key={address}
        title="Create Multi-Sig Wallet"
        visible={isCreateModalVisible}
        onCancel={handleCancel}
        destroyOnClose
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancel
          </Button>,

          // on create
          deployType === "CREATE" && (
            <Button
              key="submit"
              type="primary"
              loading={pendingCreate}
              onClick={handleSubmit}
              disabled={isWalletExist || Boolean(walletName) === false || Boolean(signaturesRequired) === false}
            >
              Create
            </Button>
          ),

          // on redeploy on new network
          deployType === "RE_DEPLOY" && (
            <Button
              key="submit"
              type="primary"
              loading={pendingCreate}
              onClick={handleSubmit}
              disabled={Boolean(signaturesRequired) === false}
            >
              Deploy
            </Button>
          ),
        ]}
      >
        {txSent && (
          <CreateModalSentOverlay
            txError={txError}
            txSuccess={txSuccess}
            pendingText="Creating Multi-Sig"
            successText="Multi-Sig Created"
            errorText="Transaction Failed"
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input
            placeholder="Enter wallet name"
            // onChange={event => setWalletName(event.target.value)}
            onChange={event => onInputWalletName(event.target.value)}
            // value={reDeployWallet !== undefined ? reDeployWallet["walletName"] : walletName}
            value={deployType === "RE_DEPLOY" ? (reDeployWallet ? reDeployWallet["walletName"] : "") : walletName}
            disabled={deployType === "RE_DEPLOY"}
            key={address}
            onBlur={checkWalletExist}
          />
          {isWalletExist && <Alert message="Wallet name already exist choose another name !!" type="error" showIcon />}

          {preComputedAddress && (
            <>
              <div className="text-xs text-gray-500">Wallet address should be </div>
              <Address address={preComputedAddress} />
            </>
          )}
          {owners.map((owner, index) => (
            <div key={index} style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: "90%" }}>
                <AddressInput
                  autoFocus
                  ensProvider={mainnetProvider}
                  placeholder={"Owner address"}
                  value={owner}
                  onChange={val => updateOwner(val, index)}
                />
              </div>
              {index > 0 && (
                <Button style={{ padding: "0 0.5rem" }} danger onClick={() => removeOwnerField(index)}>
                  <DeleteOutlined />
                </Button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", width: "90%" }}>
            <Button onClick={addOwnerField}>
              <PlusOutlined />
            </Button>
          </div>
          <div style={{ width: "90%" }}>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Number of signatures required"
              value={signaturesRequired}
              // value={
              //   deployType === "RE_DEPLOY"
              //     ? reDeployWallet
              //       ? reDeployWallet["signaturesRequired"]
              //       : ""
              //     : signaturesRequired
              // }
              onChange={setSignaturesRequired}
            />
          </div>
          <div style={{ width: "90%" }}>
            <EtherInput
              placeholder="Fund your multi-sig (optional)"
              price={price}
              mode="USD"
              value={amount}
              onChange={setAmount}
              hideMaxButton={true}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

const checkProps = (prePorps, nextProps) => {
  return nextProps?.address !== prePorps?.address;
};
export default React.memo(CreateMultiSigModal, checkProps);
