import React, { useEffect } from "react";
import { Select, List, Spin, Collapse } from "antd";
import { Address } from "..";
import { useOwners } from "../../hooks";

const { Panel } = Collapse;

export default function Owners({ ownerEvents, signaturesRequired, mainnetProvider, blockExplorer }) {
  const { owners, previousOwners } = useOwners({ ownerEvents });

  return (
    <div>
      <h2 style={{ marginTop: 32 }}>
        Signatures Required: {signaturesRequired ? signaturesRequired.toNumber() : <Spin></Spin>}
      </h2>
      <List
        header={<h2>Owners</h2>}
        style={{ maxWidth: 400, margin: "auto", marginTop: 32 }}
        bordered
        dataSource={[...owners]}
        renderItem={ownerAddress => {
          return (
            <List.Item key={"owner_" + ownerAddress}>
              <Address
                address={ownerAddress}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
                fontSize={24}
              />
            </List.Item>
          );
        }}
      />

      <Collapse
        collapsible={previousOwners.length === 0 ? "disabled" : ""}
        style={{ maxWidth: 400, margin: "auto", marginTop: 10 }}
      >
        <Panel header="Previous Owners" key="1">
          <List
            dataSource={previousOwners}
            renderItem={prevOwnerAddress => {
              return (
                <List.Item key={"owner_" + prevOwnerAddress}>
                  <Address
                    address={prevOwnerAddress}
                    ensProvider={mainnetProvider}
                    blockExplorer={blockExplorer}
                    fontSize={24}
                  />
                </List.Item>
              );
            }}
          />
        </Panel>
      </Collapse>
    </div>
  );
}
