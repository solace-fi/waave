import { waffle, ethers } from "hardhat";
const { deployContract, solidity } = waffle;
import { MockProvider } from "ethereum-waffle";
const provider: MockProvider = waffle.provider;
import { BigNumber as BN, Contract, Wallet } from "ethers";
import chai from "chai";
const { expect } = chai;
chai.use(solidity);
import { config as dotenv_config } from "dotenv";
dotenv_config();

import { import_artifacts, ArtifactImports } from "./utilities/artifact_importer";
import { WaToken } from "../typechain";
import { setStorageAt, toBytes32 } from "./utilities/setStorage";

describe("waBAT", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, depositor1, depositor2] = provider.getWallets();

  let bat: Contract;
  let waBat: WaToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TEN_ETHER = BN.from("10000000000000000000");

  before(async function() {
    artifacts = await import_artifacts();

    if(process.env.FORK_NETWORK === "mainnet"){
      bat = (await ethers.getContractAt(artifacts.ERC20.abi, "0x0D8775F648430679A709E98d2b0Cb6250d2887EF")) as Contract;
    } else if(process.env.FORK_NETWORK === "rinkeby"){
      bat = (await ethers.getContractAt(artifacts.ERC20.abi, "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99")) as Contract;
    } else if(process.env.FORK_NETWORK === "kovan"){
      bat = (await deployContract(deployer, artifacts.MockERC20, ["Basic Attention Token", "BAT", 18])) as Contract;
    } else {
      bat = (await deployContract(deployer, artifacts.MockERC20, ["Basic Attention Token", "BAT", 18])) as Contract;
    }

    // create underlying positions
    const INITIAL_BALANCE = TEN_ETHER;
    var value = toBytes32(INITIAL_BALANCE).toString();
    for(var j = 0; j < 200; ++j) {
      try { // solidity rigged balanceOf
        var index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[governor.address,j]);
        await setStorageAt(bat.address, index, value);
        var uBalance = await bat.balanceOf(governor.address);
        if(uBalance.eq(INITIAL_BALANCE)) {
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor1.address,j]);
          await setStorageAt(bat.address, index, value);
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor2.address,j]);
          await setStorageAt(bat.address, index, value);
          break;
        }
      } catch(e) { }
    }
    expect(await bat.balanceOf(governor.address)).to.equal(INITIAL_BALANCE);
  });

  describe("deployment", async function () {
    it("deploys successfully", async function () {
      waBat = (await deployContract(deployer, artifacts.waToken, [governor.address, bat.address])) as WaToken;
    });
    it("has the right name", async function () {
      let expectedName =
          process.env.FORK_NETWORK === "mainnet" ? "waave Basic Attention Token"
        : process.env.FORK_NETWORK === "rinkeby" ? "waave Basic Attention Token"
        : process.env.FORK_NETWORK === "kovan" ? "waave Basic Attention Token"
        : "waave Basic Attention Token";
      expect(await waBat.name()).to.equal(expectedName);
    });
    it("has the right symbol", async function () {
      expect(await waBat.symbol()).to.equal("waBAT");
    });
    it("has the right decimals", async function () {
      expect(await waBat.decimals()).to.equal(18);
    });
  })

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waBat.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waBat.connect(depositor1).setGovernance(depositor1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waBat.connect(governor).setGovernance(depositor1.address);
      expect(await waBat.governance()).to.equal(governor.address);
      expect(await waBat.newGovernance()).to.equal(depositor1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waBat.connect(depositor2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waBat.connect(depositor1).acceptGovernance();
      await expect(tx)
        .to.emit(waBat, "GovernanceTransferred")
        .withArgs(depositor1.address);
      expect(await waBat.governance()).to.equal(depositor1.address);
      expect(await waBat.newGovernance()).to.equal(ZERO_ADDRESS);

      await waBat.connect(depositor1).setGovernance(governor.address);
      await waBat.connect(governor).acceptGovernance();
    });
  });

  describe("deposit", function () {
    before(async function () {
      await bat.connect(governor).approve(waBat.address, TEN_ETHER);
      await bat.connect(depositor1).approve(waBat.address, TEN_ETHER);
      await bat.connect(depositor2).approve(waBat.address, TEN_ETHER);
    });
    it("initially mints 1:1", async function () {
      let pps = await waBat.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waBat.decimals()));
      let depositAmount = BN.from("1234000000000000000");
      let bals1 = await getBalances(depositor1);
      await waBat.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaBat).to.equal(depositAmount);
      expect(balDiffs.waBatBat).to.equal(depositAmount);
      pps = await waBat.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waBat.decimals()));
    });
    it("still mints 1:1", async function () {
      let depositAmount = BN.from("567000000000000000");
      let bals1 = await getBalances(depositor2);
      await waBat.connect(depositor2).deposit(depositAmount);
      let bals2 = await getBalances(depositor2);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaBat).to.equal(depositAmount);
      expect(balDiffs.waBatBat).to.equal(depositAmount);
      let pps = await waBat.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waBat.decimals()));
    });
    it("mints to maintain price per share", async function () {
      await bat.connect(governor).transfer(waBat.address, "9125347");
      let ts = await waBat.totalSupply();
      let ta = await bat.balanceOf(waBat.address);
      let pps1 = await waBat.pricePerShare();
      expect(pps1).to.be.gt(BN.from(10).pow(await waBat.decimals()));
      let depositAmount = BN.from("987000000000000000");
      let mintAmount = depositAmount.mul(ts).div(ta);
      expect(mintAmount).to.not.equal(depositAmount);
      let bals1 = await getBalances(depositor1);
      await waBat.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaBat).to.equal(mintAmount);
      expect(balDiffs.waBatBat).to.equal(depositAmount);
      let pps2 = await waBat.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    });
  });

  describe("withdraw", function () {
    before(async function () {
      waBat = (await deployContract(deployer, artifacts.waToken, [governor.address, bat.address])) as WaToken;
      await bat.connect(governor).approve(waBat.address, TEN_ETHER);
      await bat.connect(depositor1).approve(waBat.address, TEN_ETHER);
      await bat.connect(depositor2).approve(waBat.address, TEN_ETHER);
      await waBat.connect(depositor1).deposit("12345678901234567");
      await waBat.connect(depositor2).deposit("98746211588955626");
    });
    it("initially burns 1:1", async function () {
      let withdrawAmount = BN.from("151515151515151");
      let bals1 = await getBalances(depositor1);
      await waBat.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(withdrawAmount);
      expect(balDiffs.userWaBat).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waBatBat).to.equal(withdrawAmount.mul(-1));
    });
    it("burns to maintain price per share", async function () {
      await bat.connect(governor).transfer(waBat.address, "9125347");
      let ts = await waBat.totalSupply();
      let ta = await bat.balanceOf(waBat.address);
      let pps1 = await waBat.pricePerShare();
      let withdrawAmount = BN.from("151515151515151");
      let burnAmount = withdrawAmount.mul(ta).div(ts);
      expect(burnAmount).to.not.equal(withdrawAmount);
      let bals1 = await getBalances(depositor1);
      await waBat.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(burnAmount);
      expect(balDiffs.userWaBat).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waBatBat).to.equal(burnAmount.mul(-1));
      let pps2 = await waBat.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    })
  });

  describe("exploit", async function () {
    it("rejects exploit by non governance", async function () {
      await expect(waBat.connect(depositor1).lose(0)).to.be.revertedWith("!governance");
    });
    it("pulls money from the vault", async function () {
      let pps1 = await waBat.pricePerShare();
      let exploitAmount = (await bat.balanceOf(waBat.address)).div(3);
      let bals1 = await getBalances(governor);
      await waBat.connect(governor).lose(exploitAmount);
      let bals2 = await getBalances(governor);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userBat).to.equal(exploitAmount);
      expect(balDiffs.userWaBat).to.equal(0);
      expect(balDiffs.waBatBat).to.equal(exploitAmount.mul(-1));
      let pps2 = await waBat.pricePerShare();
      expect(pps2).to.be.lt(pps1);
    });
  });
  /*
  if(process.env.FORK_NETWORK !== "mainnet") {
    describe("mint", function () {
      it("can mint testnet bat", async function () {
        let bal1 = await bat.balanceOf(depositor1.address);
        await bat.connect(depositor1).mint();
        let bal2 = await bat.balanceOf(depositor1.address);
        expect(bal2.sub(bal1)).to.equal(BN.from("100000000000000000000"));
      })
    });
  }
  */
  interface Balances {
    userBat: BN;
    userWaBat: BN;
    waBatBat: BN;
  }

  async function getBalances(user: Wallet): Promise<Balances> {
    return {
      userBat: await bat.balanceOf(user.address),
      userWaBat: await waBat.balanceOf(user.address),
      waBatBat: await bat.balanceOf(waBat.address)
    };
  }

  function getBalancesDiff(balances1: Balances, balances2: Balances): Balances {
    return {
      userBat: balances1.userBat.sub(balances2.userBat),
      userWaBat: balances1.userWaBat.sub(balances2.userWaBat),
      waBatBat: balances1.waBatBat.sub(balances2.waBatBat)
    };
  }
});
