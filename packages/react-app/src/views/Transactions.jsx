import React, { useCallback, useEffect, useState } from "react";
import { Button, List, Divider, Input, Card, DatePicker, Slider, Switch, Progress, Spin } from "antd";
import { parseEther, formatEther } from "@ethersproject/units";
import { ethers } from "ethers";
import { TransactionListItem } from "../components";
import { useTransactions } from "../contexts";

export default function Transactions({
  poolServerUrl,
  contractName,
  signaturesRequired,
  address,
  nonce,
  userSigner,
  mainnetProvider,
  localProvider,
  yourLocalBalance,
  price,
  tx,
  readContracts,
  writeContracts,
  blockExplorer,
}) {
  const { unvalidatedTransactions, saveTransactions } = useTransactions();
  const [transactions, setTransactions] = useState([]);
  const contract = readContracts[contractName];
  useEffect(() => {
    console.log("Validate triggered");
    const validateTransactions = async () => {
      if (!unvalidatedTransactions) {
        return;
      }
      const newTransactions = [];
      for (const tx of Object.values(unvalidatedTransactions)) {
        console.log("backend stuff tx", tx);
        const thisNonce = ethers.BigNumber.from(tx.nonce);
        if (thisNonce && nonce && thisNonce.gte(nonce)) {
          const validSignatures = [];
          for (const sig in tx.signatures) {
            const signer = await contract.recover(tx.hash, tx.signatures[sig]);
            const isOwner = await contract.isOwner(signer);
            if (signer && isOwner) {
              validSignatures.push({ signer, signature: tx.signatures[sig] });
            }
          }

          const update = { ...tx, validSignatures };
          newTransactions.push(update);
        }
      }

      console.log("backend stuff newTransactions", newTransactions);

      setTransactions(newTransactions);
    };

    validateTransactions().catch(e => console.error("Error validating transactions", e));
  }, [contract, unvalidatedTransactions, nonce]);

  const getSortedSigList = async (allSigs, newHash) => {
    const sigList = [];
    for (const sig in allSigs) {
      const recover = await readContracts[contractName].recover(newHash, allSigs[sig]);
      sigList.push({ signature: allSigs[sig], signer: recover });
    }

    sigList.sort((a, b) => {
      return ethers.BigNumber.from(a.signer).sub(ethers.BigNumber.from(b.signer));
    });

    const finalSigList = [];
    const finalSigners = [];
    const used = {};
    for (const sig in sigList) {
      if (!used[sigList[sig].signature]) {
        finalSigList.push(sigList[sig].signature);
        finalSigners.push(sigList[sig].signer);
      }
      used[sigList[sig].signature] = true;
    }

    return [finalSigList, finalSigners];
  };

  if (!signaturesRequired) {
    return <Spin />;
  }

  return (
    <div style={{ maxWidth: 850, margin: "auto", marginTop: 32, marginBottom: 32 }}>
      <h1>
        <b style={{ padding: 16 }}>#{nonce ? nonce.toNumber() : <Spin />}</b>
      </h1>

      <List
        bordered
        dataSource={transactions}
        renderItem={item => {
          const hasSigned = item.signers.indexOf(address) >= 0;
          const hasEnoughSignatures = item.signatures.length <= signaturesRequired.toNumber();

          console.log("transaction details:", item);

          return (
            <TransactionListItem
              item={item}
              mainnetProvider={mainnetProvider}
              blockExplorer={blockExplorer}
              price={price}
              readContracts={readContracts}
              contractName={contractName}
            >
              <div style={{ padding: 16 }}>
                <span style={{ padding: 4 }}>
                  {item.signatures.length}/{signaturesRequired.toNumber()} {hasSigned ? "✅" : ""}
                </span>
                <span style={{ padding: 4 }}>
                  <Button
                    type="secondary"
                    onClick={async () => {
                      const newHash = await readContracts[contractName].getTransactionHash(
                        item.nonce,
                        item.to,
                        parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                      );

                      const signature = await userSigner?.signMessage(ethers.utils.arrayify(newHash));
                      const recover = await readContracts[contractName].recover(newHash, signature);
                      const isOwner = await readContracts[contractName].isOwner(recover);
                      if (isOwner) {
                        const [finalSigList, finalSigners] = await getSortedSigList(
                          [...item.signatures, signature],
                          newHash,
                        );
                        await saveTransactions({
                          ...item,
                          signatures: finalSigList,
                          signers: finalSigners,
                        });
                      }
                    }}
                  >
                    Sign
                  </Button>
                  <Button
                    key={item.hash}
                    type={hasEnoughSignatures ? "primary" : "secondary"}
                    onClick={async () => {
                      const newHash = await readContracts[contractName].getTransactionHash(
                        item.nonce,
                        item.to,
                        parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                      );

                      const [finalSigList, finalSigners] = await getSortedSigList(item.signatures, newHash);

                      console.log(
                        "writeContracts: ",
                        item.to,
                        parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                        finalSigList,
                      );

                      tx(
                        writeContracts[contractName].executeTransaction(
                          item.to,
                          parseEther("" + parseFloat(item.amount).toFixed(12)),
                          item.data,
                          finalSigList,
                        ),
                      );
                    }}
                  >
                    Exec
                  </Button>
                </span>
              </div>
            </TransactionListItem>
          );
        }}
      />
    </div>
  );
}
