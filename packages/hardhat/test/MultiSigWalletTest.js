const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("MultiSigWallet Test", () => {
  const CHAIN_ID = 1; // I guess this number doesn't really matter
  let signatureRequired = 1; // Starting with something straithforward

  let TestERC20Token;
  const TEST_ERC20_TOKEN_TOTAL_SUPPLY = "100";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    let MultiSigFactoryContractFactory = await ethers.getContractFactory("MultiSigFactory");
    MultiSigFactory = await MultiSigFactoryContractFactory.deploy();

    await MultiSigFactory.create(CHAIN_ID, [owner.address], signatureRequired);
    let [multiSigWalletAddress] = await MultiSigFactory.getMultiSig(0);

    let MultiSigWalletContractFactory = await ethers.getContractFactory("MultiSigWallet");
    MultiSigWallet = await MultiSigWalletContractFactory.attach(multiSigWalletAddress);

    await owner.sendTransaction({
      to: MultiSigWallet.address,
      value: ethers.utils.parseEther("1.0")
    });

    provider = owner.provider;

    // Create TestERC20Token token, minting 100 for the multiSigWallet
    let TestERC20TokenContractFactory = await ethers.getContractFactory("TestERC20Token");
    TestERC20Token = await TestERC20TokenContractFactory.deploy(MultiSigWallet.address, ethers.utils.parseEther(TEST_ERC20_TOKEN_TOTAL_SUPPLY));

    getAddSignerHash = async (newSignerAddress, newSignaturesRequired) => {
      let nonce = await MultiSigWallet.nonce();
      let to = MultiSigWallet.address;
      let value = "0x0";

      let callData = getAddSignerCallData(newSignerAddress, newSignaturesRequired);
      
      return await MultiSigWallet.getTransactionHash(nonce, to, value, callData);
    }

    getRemoveSignerHash = async (oldSignerAddress, newSignaturesRequired) => {
      let nonce = await MultiSigWallet.nonce();
      let to = MultiSigWallet.address;
      let value = "0x0";

      let callData = getRemoveSignerCallData(oldSignerAddress, newSignaturesRequired);
      
      return await MultiSigWallet.getTransactionHash(nonce, to, value, callData);
    }

    getAddSignerCallData = (newSignerAddress, newSignaturesRequired) => {
      return MultiSigWallet.interface.encodeFunctionData("addSigner",[newSignerAddress, newSignaturesRequired]);
    }

    getRemoveSignerCallData = (oldSignerAddress, newSignaturesRequired) => {
      return MultiSigWallet.interface.encodeFunctionData("removeSigner",[oldSignerAddress, newSignaturesRequired]);
    }

    getSortedOwnerAddressesArray = async () => {
      let ownerAddressesArray = [];

      for (let i = 0; ; i++) {
        try {
          ownerAddressesArray.push(await MultiSigWallet.owners(i));  
        }
        catch {
          break;
        }
      }

      return ownerAddressesArray.sort();
    }

    getSignaturesArray = async (hash) => {
      let signaturesArray = [];

      let sortedOwnerAddressesArray = await getSortedOwnerAddressesArray();

      for (ownerAddress of sortedOwnerAddressesArray) {
        let ownerProvider = (await ethers.getSigner(owner.address)).provider;

        signaturesArray.push(await ownerProvider.send("personal_sign", [hash, ownerAddress]));
      }

      return signaturesArray;
    }
  });

  describe("Deployment", () => {
    it("isOwner should return true for the deployer owner address", async () => {
      expect(await MultiSigWallet.isOwner(owner.address)).to.equal(true);
    });

    it("Multi Sig Wallet should own all the TestERC20Token token", async () => {
      let MultiSigWalletTestERC20TokenBalance = await TestERC20Token.balanceOf(MultiSigWallet.address);

      expect(MultiSigWalletTestERC20TokenBalance).to.equal(ethers.utils.parseEther(TEST_ERC20_TOKEN_TOTAL_SUPPLY));
    });
  });

  describe("Testing MultiSigWallet functionality", () => {
    // This works because removeSigner works correctly when removing the last signer from the array.
    it("Adding a new signer, then removing it", async () => {
      let newSignerAddress = addr1.address;
      let newSignaturesRequired = 2;

      let addSignerHash = await getAddSignerHash(newSignerAddress, newSignaturesRequired);

      await MultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getAddSignerCallData(newSignerAddress, newSignaturesRequired), 
        await getSignaturesArray(addSignerHash));

      expect(await MultiSigWallet.isOwner(newSignerAddress)).to.equal(true);

      let removeSignerAddress = newSignerAddress;

      let removeSignerHash = await getRemoveSignerHash(removeSignerAddress, newSignaturesRequired - 1);

      await MultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getRemoveSignerCallData(removeSignerAddress, newSignaturesRequired - 1), 
        await getSignaturesArray(removeSignerHash));

      expect(await MultiSigWallet.isOwner(removeSignerAddress)).to.equal(false);
      expect(await MultiSigWallet.owners(0)).to.equal(owner.address);
    });

    // This doesn't work because removeSigner cannot correctly remove a signer which is not the last in the array.
    it("Adding a new signer, then removing the old one", async () => {
      let newSignerAddress = addr1.address;
      let newSignaturesRequired = 2;

      let addSignerHash = await getAddSignerHash(newSignerAddress, newSignaturesRequired);

      await MultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getAddSignerCallData(newSignerAddress, newSignaturesRequired), 
        await getSignaturesArray(addSignerHash));

      expect(await MultiSigWallet.isOwner(newSignerAddress)).to.equal(true);

      let removeSignerAddress = owner.address;

      let removeSignerHash = await getRemoveSignerHash(removeSignerAddress, newSignaturesRequired - 1);

      await MultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getRemoveSignerCallData(removeSignerAddress, newSignaturesRequired - 1), 
        await getSignaturesArray(removeSignerHash));

      expect(await MultiSigWallet.isOwner(removeSignerAddress)).to.equal(false);
      expect(await MultiSigWallet.owners(0)).to.equal(newSignerAddress);
    });

    it("Adding a new signer - execute with owner", async () => {
      let newSignerAddress = addr1.address;
      let newSignaturesRequired = 2;

      let hash = await getAddSignerHash(newSignerAddress, newSignaturesRequired);

      await MultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getAddSignerCallData(newSignerAddress, newSignaturesRequired), 
        await getSignaturesArray(hash));

      expect(await MultiSigWallet.isOwner(newSignerAddress)).to.equal(true);
    });

    it("Adding a new signer - execute with external account", async () => {
      let newSignerAddress = addr1.address;
      let newSignaturesRequired = 2;

      let hash = await getAddSignerHash(newSignerAddress, newSignaturesRequired);

      let addr2ConnectedMultiSigWallet = await MultiSigWallet.connect(addr2)

      await addr2ConnectedMultiSigWallet.executeTransaction(
        MultiSigWallet.address, "0x0",
        getAddSignerCallData(newSignerAddress, newSignaturesRequired), 
        await getSignaturesArray(hash));

      expect(await MultiSigWallet.isOwner(newSignerAddress)).to.equal(true);
    });

    it("Transaction reverted: Remove the only signer", async () => {
      let removeSignerAddress = owner.address;
      let newSignaturesRequired = 1;

      let removeSignerHash = await getRemoveSignerHash(removeSignerAddress, newSignaturesRequired);

      await expect(
        MultiSigWallet.executeTransaction(
          MultiSigWallet.address, "0x0",
          getRemoveSignerCallData(removeSignerAddress, newSignaturesRequired), 
          await getSignaturesArray(removeSignerHash)))
        .to.be.revertedWith("executeTransaction: tx failed");
    });

    it("Transaction reverted: Invalid MultiSigWallet, more signatures required than signers", async () => {
      await expect(
          MultiSigFactory.create(CHAIN_ID, [owner.address], 2)
        ).to.be.revertedWith("Must be at least the same amount of signers than signatures required");
    });

    it("Transaction reverted: Update Signatures Required to 2 - trying to lock all the funds in the wallet, becasuse there is only 1 signer", async () => {
      let nonce = await MultiSigWallet.nonce();
      let to = MultiSigWallet.address;
      let value = 0;

      let callData = MultiSigWallet.interface.encodeFunctionData("updateSignaturesRequired",[2]);
      
      let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData);
      const signature = await owner.provider.send("personal_sign", [hash, owner.address]);

      // Double checking if owner address is recovered properly, executeTransaction would fail anyways
      expect(await MultiSigWallet.recover(hash, signature)).to.equal(owner.address);

      await expect(
          MultiSigWallet.executeTransaction(to, value, callData, [signature])
        ).to.be.revertedWith("executeTransaction: tx failed");
    });

    it("Transferring 0.1 eth to addr1", async () => {
      let addr1BeforeBalance = await provider.getBalance(addr1.address);

      let nonce = await MultiSigWallet.nonce();
      let to = addr1.address;
      let value = ethers.utils.parseEther("0.1");

      let callData = "0x00"; // This can be anything, we could send a message 
      
      let hash = await MultiSigWallet.getTransactionHash(nonce, to, value.toString(), callData);
      const signature = await owner.provider.send("personal_sign", [hash, owner.address]);

      await MultiSigWallet.executeTransaction(to, value.toString(), callData, [signature]);

      let addr1Balance = await provider.getBalance(addr1.address);

      expect(addr1Balance).to.equal(addr1BeforeBalance.add(value));
    });

    it("Allowing addr1 to spend 10 TestERC20Tokens. Then addr1 transfers the TestERC20Tokens to addr2", async () => {
      let amount = ethers.utils.parseEther("10");

      let nonce = await MultiSigWallet.nonce();
      let to = TestERC20Token.address;
      let value = 0

      let callData = TestERC20Token.interface.encodeFunctionData("approve",[addr1.address, amount]);
      
      let hash = await MultiSigWallet.getTransactionHash(nonce, to, value.toString(), callData);
      const signature = await owner.provider.send("personal_sign", [hash, owner.address]);

      await MultiSigWallet.executeTransaction(to, value.toString(), callData, [signature]);

      let MultiSigWallet_addr1Allowance = await TestERC20Token.allowance(MultiSigWallet.address, addr1.address);
      expect(MultiSigWallet_addr1Allowance).to.equal(amount);

      await TestERC20Token.connect(addr1).transferFrom(MultiSigWallet.address, addr2.address, amount);

      let addr2TestERC20TokenBalance = await TestERC20Token.balanceOf(addr2.address);
      expect(addr2TestERC20TokenBalance).to.equal(amount);
    });
  });
});