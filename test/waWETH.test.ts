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
import { WaToken, Weth9 } from "../typechain";

describe("waWETH", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, depositor1, depositor2] = provider.getWallets();

  let weth: Weth9;
  let waWeth: WaToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TEN_ETHER = BN.from("10000000000000000000");

  before(async function() {
    artifacts = await import_artifacts();

    if(process.env.FORK_NETWORK === "mainnet"){
      weth = (await ethers.getContractAt(artifacts.WETH.abi, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")) as Weth9;
    } else if(process.env.FORK_NETWORK === "rinkeby"){
      weth = (await ethers.getContractAt(artifacts.WETH.abi, "0xc778417E063141139Fce010982780140Aa0cD5Ab")) as Weth9;
    } else if(process.env.FORK_NETWORK === "kovan"){
      weth = (await ethers.getContractAt(artifacts.WETH.abi, "0xd0A1E359811322d97991E03f863a0C30C2cF029C")) as Weth9;
    } else {
      weth = (await deployContract(deployer, artifacts.WETH)) as Weth9;
    }

    // create underlying positions
    await weth.connect(governor).deposit({ value: TEN_ETHER });
    await weth.connect(depositor1).deposit({ value: TEN_ETHER });
    await weth.connect(depositor2).deposit({ value: TEN_ETHER });
  });

  describe("deployment", async function () {
    it("deploys successfully", async function () {
      waWeth = (await deployContract(deployer, artifacts.waToken, [governor.address, weth.address])) as WaToken;
    });
    it("has the right name", async function () {
      expect(await waWeth.name()).to.equal("waave Wrapped Ether");
    });
    it("has the right symbol", async function () {
      expect(await waWeth.symbol()).to.equal("waWETH");
    });
    it("has the right decimals", async function () {
      expect(await waWeth.decimals()).to.equal(18);
    });
  })

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waWeth.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waWeth.connect(depositor1).setGovernance(depositor1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waWeth.connect(governor).setGovernance(depositor1.address);
      expect(await waWeth.governance()).to.equal(governor.address);
      expect(await waWeth.newGovernance()).to.equal(depositor1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waWeth.connect(depositor2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waWeth.connect(depositor1).acceptGovernance();
      await expect(tx)
        .to.emit(waWeth, "GovernanceTransferred")
        .withArgs(depositor1.address);
      expect(await waWeth.governance()).to.equal(depositor1.address);
      expect(await waWeth.newGovernance()).to.equal(ZERO_ADDRESS);

      await waWeth.connect(depositor1).setGovernance(governor.address);
      await waWeth.connect(governor).acceptGovernance();
    });
  });

  describe("deposit", function () {
    before(async function () {
      await weth.connect(governor).approve(waWeth.address, TEN_ETHER);
      await weth.connect(depositor1).approve(waWeth.address, TEN_ETHER);
      await weth.connect(depositor2).approve(waWeth.address, TEN_ETHER);
    });
    it("initially mints 1:1", async function () {
      let pps = await waWeth.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWeth.decimals()));
      let depositAmount = BN.from("1234000000000000000");
      let bals1 = await getBalances(depositor1);
      await waWeth.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWeth).to.equal(depositAmount);
      expect(balDiffs.waWethWeth).to.equal(depositAmount);
      pps = await waWeth.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWeth.decimals()));
    });
    it("still mints 1:1", async function () {
      let depositAmount = BN.from("567000000000000000");
      let bals1 = await getBalances(depositor2);
      await waWeth.connect(depositor2).deposit(depositAmount);
      let bals2 = await getBalances(depositor2);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWeth).to.equal(depositAmount);
      expect(balDiffs.waWethWeth).to.equal(depositAmount);
      let pps = await waWeth.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWeth.decimals()));
    });
    it("mints to maintain price per share", async function () {
      await weth.connect(governor).transfer(waWeth.address, "9125347");
      let ts = await waWeth.totalSupply();
      let ta = await weth.balanceOf(waWeth.address);
      let pps1 = await waWeth.pricePerShare();
      expect(pps1).to.be.gt(BN.from(10).pow(await waWeth.decimals()));
      let depositAmount = BN.from("987000000000000000");
      let mintAmount = depositAmount.mul(ts).div(ta);
      expect(mintAmount).to.not.equal(depositAmount);
      let bals1 = await getBalances(depositor1);
      await waWeth.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWeth).to.equal(mintAmount);
      expect(balDiffs.waWethWeth).to.equal(depositAmount);
      let pps2 = await waWeth.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    });
  });

  describe("withdraw", function () {
    before(async function () {
      waWeth = (await deployContract(deployer, artifacts.waToken, [governor.address, weth.address])) as WaToken;
      await weth.connect(governor).approve(waWeth.address, TEN_ETHER);
      await weth.connect(depositor1).approve(waWeth.address, TEN_ETHER);
      await weth.connect(depositor2).approve(waWeth.address, TEN_ETHER);
      await waWeth.connect(depositor1).deposit("12345678901234567");
      await waWeth.connect(depositor2).deposit("98746211588955626");
    });
    it("initially burns 1:1", async function () {
      let withdrawAmount = BN.from("151515151515151");
      let bals1 = await getBalances(depositor1);
      await waWeth.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(withdrawAmount);
      expect(balDiffs.userWaWeth).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waWethWeth).to.equal(withdrawAmount.mul(-1));
    });
    it("burns to maintain price per share", async function () {
      await weth.connect(governor).transfer(waWeth.address, "9125347");
      let ts = await waWeth.totalSupply();
      let ta = await weth.balanceOf(waWeth.address);
      let pps1 = await waWeth.pricePerShare();
      let withdrawAmount = BN.from("151515151515151");
      let burnAmount = withdrawAmount.mul(ta).div(ts);
      expect(burnAmount).to.not.equal(withdrawAmount);
      let bals1 = await getBalances(depositor1);
      await waWeth.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(burnAmount);
      expect(balDiffs.userWaWeth).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waWethWeth).to.equal(burnAmount.mul(-1));
      let pps2 = await waWeth.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    })
  });

  describe("exploit", async function () {
    it("rejects exploit by non governance", async function () {
      await expect(waWeth.connect(depositor1).lose(0)).to.be.revertedWith("!governance");
    });
    it("pulls money from the vault", async function () {
      let pps1 = await waWeth.pricePerShare();
      let exploitAmount = (await weth.balanceOf(waWeth.address)).div(3);
      let bals1 = await getBalances(governor);
      await waWeth.connect(governor).lose(exploitAmount);
      let bals2 = await getBalances(governor);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWeth).to.equal(exploitAmount);
      expect(balDiffs.userWaWeth).to.equal(0);
      expect(balDiffs.waWethWeth).to.equal(exploitAmount.mul(-1));
      let pps2 = await waWeth.pricePerShare();
      expect(pps2).to.be.lt(pps1);
    });
  });

  interface Balances {
    userWeth: BN;
    userWaWeth: BN;
    waWethWeth: BN;
  }

  async function getBalances(user: Wallet): Promise<Balances> {
    return {
      userWeth: await weth.balanceOf(user.address),
      userWaWeth: await waWeth.balanceOf(user.address),
      waWethWeth: await weth.balanceOf(waWeth.address)
    };
  }

  function getBalancesDiff(balances1: Balances, balances2: Balances): Balances {
    return {
      userWeth: balances1.userWeth.sub(balances2.userWeth),
      userWaWeth: balances1.userWaWeth.sub(balances2.userWaWeth),
      waWethWeth: balances1.waWethWeth.sub(balances2.waWethWeth)
    };
  }
});
