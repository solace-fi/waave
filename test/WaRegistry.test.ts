import { waffle, ethers } from "hardhat";
const { deployContract, solidity } = waffle;
import { MockProvider } from "ethereum-waffle";
const provider: MockProvider = waffle.provider;
import { BigNumber as BN, Wallet } from "ethers";
import chai from "chai";
const { expect } = chai;
chai.use(solidity);
import { config as dotenv_config } from "dotenv";
dotenv_config();

import { import_artifacts, ArtifactImports } from "./utilities/artifact_importer";
import { WaRegistry  } from "../typechain";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("WaRegistry", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, acc1, acc2] = provider.getWallets();

  let waRegistry: WaRegistry;

  before(async function() {
    artifacts = await import_artifacts();

    waRegistry = (await deployContract(deployer, artifacts.WaRegistry, [governor.address])) as WaRegistry;
  });

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waRegistry.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waRegistry.connect(acc1).setGovernance(acc1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waRegistry.connect(governor).setGovernance(acc1.address);
      expect(await waRegistry.governance()).to.equal(governor.address);
      expect(await waRegistry.newGovernance()).to.equal(acc1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waRegistry.connect(acc2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waRegistry.connect(acc1).acceptGovernance();
      await expect(tx)
        .to.emit(waRegistry, "GovernanceTransferred")
        .withArgs(acc1.address);
      expect(await waRegistry.governance()).to.equal(acc1.address);
      expect(await waRegistry.newGovernance()).to.equal(ZERO_ADDRESS);

      await waRegistry.connect(acc1).setGovernance(governor.address);
      await waRegistry.connect(governor).acceptGovernance();
    });
  });

  describe("waTokens", function () {
    it("starts with no tokens", async function () {
      expect(await waRegistry.numTokens()).to.equal(0);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([]);
    });
    it("rejects add by non governor", async function () {
      await expect(waRegistry.addToken(acc1.address)).to.be.revertedWith("!governance");
    });
    it("can add tokens", async function () {
      await waRegistry.connect(governor).addToken(acc1.address);
      expect(await waRegistry.numTokens()).to.equal(1);
      expect(await waRegistry.waTokenAt(0)).to.equal(acc1.address);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([acc1.address]);

      await waRegistry.connect(governor).addToken(acc2.address);
      expect(await waRegistry.numTokens()).to.equal(2);
      expect(await waRegistry.waTokenAt(0)).to.equal(acc1.address);
      expect(await waRegistry.waTokenAt(1)).to.equal(acc2.address);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([acc1.address,acc2.address]);

      await waRegistry.connect(governor).addToken(acc2.address);
      expect(await waRegistry.numTokens()).to.equal(2);
      expect(await waRegistry.waTokenAt(0)).to.equal(acc1.address);
      expect(await waRegistry.waTokenAt(1)).to.equal(acc2.address);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([acc1.address,acc2.address]);
    });
    it("rejects remove by non governor", async function () {
      await expect(waRegistry.removeToken(acc1.address)).to.be.revertedWith("!governance");
    });
    it("can remove tokens", async function () {
      await waRegistry.connect(governor).removeToken(acc1.address);
      expect(await waRegistry.numTokens()).to.equal(1);
      expect(await waRegistry.waTokenAt(0)).to.equal(acc2.address);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([acc2.address]);

      await waRegistry.connect(governor).removeToken(acc1.address);
      expect(await waRegistry.numTokens()).to.equal(1);
      expect(await waRegistry.waTokenAt(0)).to.equal(acc2.address);
      expect(await waRegistry.getAllWaTokens()).to.deep.equal([acc2.address]);
    });
  });
});
