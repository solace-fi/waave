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

describe("waUSDT", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, depositor1, depositor2] = provider.getWallets();

  let usdt: Contract;
  let waUsdt: WaToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TEN_ETHER = BN.from("10000000000000000000");

  before(async function() {
    artifacts = await import_artifacts();

    if(process.env.FORK_NETWORK === "mainnet") {
      usdt = (await ethers.getContractAt(artifacts.ERC20.abi, "0xdAC17F958D2ee523a2206206994597C13D831ec7")) as Contract;
    } else if(process.env.FORK_NETWORK === "rinkeby") {
      usdt = (await deployContract(deployer, artifacts.MockERC20, ["Tether USD", "USDT", 6])) as Contract;
    } else if(process.env.FORK_NETWORK === "kovan") {
      usdt = (await ethers.getContractAt(artifacts.ERC20.abi, "0x13512979ADE267AB5100878E2e0f485B568328a4")) as Contract;
    } else {
      usdt = (await deployContract(deployer, artifacts.MockERC20, ["Tether USD", "USDT", 6])) as Contract;
    }

    // create underlying positions
    const INITIAL_BALANCE = TEN_ETHER;
    var value = toBytes32(INITIAL_BALANCE).toString();
    for(var j = 0; j < 200; ++j) {
      try { // solidity rigged balanceOf
        var index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[governor.address,j]);
        await setStorageAt(usdt.address, index, value);
        var uBalance = await usdt.balanceOf(governor.address);
        if(uBalance.eq(INITIAL_BALANCE)) {
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor1.address,j]);
          await setStorageAt(usdt.address, index, value);
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor2.address,j]);
          await setStorageAt(usdt.address, index, value);
          break;
        }
      } catch(e) { }
    }
    expect(await usdt.balanceOf(governor.address)).to.equal(INITIAL_BALANCE);
  });

  describe("deployment", async function () {
    it("deploys successfully", async function () {
      waUsdt = (await deployContract(deployer, artifacts.waToken, [governor.address, usdt.address])) as WaToken;
    });
    it("has the right name", async function () {
      let expectedName =
          process.env.FORK_NETWORK === "mainnet" ? "waave Tether USD"
        : process.env.FORK_NETWORK === "rinkeby" ? "waave Tether USD"
        : process.env.FORK_NETWORK === "kovan" ? "waave USDT Coin"
        : "waave Tether USD";
      expect(await waUsdt.name()).to.equal(expectedName);
    });
    it("has the right symbol", async function () {
      expect(await waUsdt.symbol()).to.equal("waUSDT");
    });
    it("has the right decimals", async function () {
      expect(await waUsdt.decimals()).to.equal(6);
    });
  })

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waUsdt.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waUsdt.connect(depositor1).setGovernance(depositor1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waUsdt.connect(governor).setGovernance(depositor1.address);
      expect(await waUsdt.governance()).to.equal(governor.address);
      expect(await waUsdt.newGovernance()).to.equal(depositor1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waUsdt.connect(depositor2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waUsdt.connect(depositor1).acceptGovernance();
      await expect(tx)
        .to.emit(waUsdt, "GovernanceTransferred")
        .withArgs(depositor1.address);
      expect(await waUsdt.governance()).to.equal(depositor1.address);
      expect(await waUsdt.newGovernance()).to.equal(ZERO_ADDRESS);

      await waUsdt.connect(depositor1).setGovernance(governor.address);
      await waUsdt.connect(governor).acceptGovernance();
    });
  });

  describe("deposit", function () {
    before(async function () {
      await usdt.connect(governor).approve(waUsdt.address, TEN_ETHER);
      await usdt.connect(depositor1).approve(waUsdt.address, TEN_ETHER);
      await usdt.connect(depositor2).approve(waUsdt.address, TEN_ETHER);
    });
    it("initially mints 1:1", async function () {
      let pps = await waUsdt.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waUsdt.decimals()));
      let depositAmount = BN.from("1234000");
      let bals1 = await getBalances(depositor1);
      await waUsdt.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaUsdt).to.equal(depositAmount);
      expect(balDiffs.waUsdtUsdt).to.equal(depositAmount);
      pps = await waUsdt.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waUsdt.decimals()));
    });
    it("still mints 1:1", async function () {
      let depositAmount = BN.from("567000");
      let bals1 = await getBalances(depositor2);
      await waUsdt.connect(depositor2).deposit(depositAmount);
      let bals2 = await getBalances(depositor2);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaUsdt).to.equal(depositAmount);
      expect(balDiffs.waUsdtUsdt).to.equal(depositAmount);
      let pps = await waUsdt.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waUsdt.decimals()));
    });
    it("mints to maintain price per share", async function () {
      await usdt.connect(governor).transfer(waUsdt.address, "9125");
      let ts = await waUsdt.totalSupply();
      let ta = await usdt.balanceOf(waUsdt.address);
      let pps1 = await waUsdt.pricePerShare();
      expect(pps1).to.be.gt(BN.from(10).pow(await waUsdt.decimals()));
      let depositAmount = BN.from("987000");
      let mintAmount = depositAmount.mul(ts).div(ta);
      expect(mintAmount).to.not.equal(depositAmount);
      let bals1 = await getBalances(depositor1);
      await waUsdt.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaUsdt).to.equal(mintAmount);
      expect(balDiffs.waUsdtUsdt).to.equal(depositAmount);
      let pps2 = await waUsdt.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    });
  });

  describe("withdraw", function () {
    before(async function () {
      waUsdt = (await deployContract(deployer, artifacts.waToken, [governor.address, usdt.address])) as WaToken;
      await usdt.connect(governor).approve(waUsdt.address, TEN_ETHER);
      await usdt.connect(depositor1).approve(waUsdt.address, TEN_ETHER);
      await usdt.connect(depositor2).approve(waUsdt.address, TEN_ETHER);
      await waUsdt.connect(depositor1).deposit("123456");
      await waUsdt.connect(depositor2).deposit("987465");
    });
    it("initially burns 1:1", async function () {
      let withdrawAmount = BN.from("15151");
      let bals1 = await getBalances(depositor1);
      await waUsdt.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(withdrawAmount);
      expect(balDiffs.userWaUsdt).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waUsdtUsdt).to.equal(withdrawAmount.mul(-1));
    });
    it("burns to maintain price per share", async function () {
      await usdt.connect(governor).transfer(waUsdt.address, "9125");
      let ts = await waUsdt.totalSupply();
      let ta = await usdt.balanceOf(waUsdt.address);
      let pps1 = await waUsdt.pricePerShare();
      let withdrawAmount = BN.from("15151");
      let burnAmount = withdrawAmount.mul(ta).div(ts);
      expect(burnAmount).to.not.equal(withdrawAmount);
      let bals1 = await getBalances(depositor1);
      await waUsdt.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(burnAmount);
      expect(balDiffs.userWaUsdt).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waUsdtUsdt).to.equal(burnAmount.mul(-1));
      let pps2 = await waUsdt.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    })
  });

  describe("exploit", async function () {
    it("rejects exploit by non governance", async function () {
      await expect(waUsdt.connect(depositor1).lose(0)).to.be.revertedWith("!governance");
    });
    it("pulls money from the vault", async function () {
      let pps1 = await waUsdt.pricePerShare();
      let exploitAmount = (await usdt.balanceOf(waUsdt.address)).div(3);
      let bals1 = await getBalances(governor);
      await waUsdt.connect(governor).lose(exploitAmount);
      let bals2 = await getBalances(governor);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userUsdt).to.equal(exploitAmount);
      expect(balDiffs.userWaUsdt).to.equal(0);
      expect(balDiffs.waUsdtUsdt).to.equal(exploitAmount.mul(-1));
      let pps2 = await waUsdt.pricePerShare();
      expect(pps2).to.be.lt(pps1);
    });
  });
  /*
  if(process.env.FORK_NETWORK !== "mainnet") {
    describe("mint", function () {
      it("can mint testnet usdt", async function () {
        let bal1 = await usdt.balanceOf(depositor1.address);
        await usdt.connect(depositor1).mint();
        let bal2 = await usdt.balanceOf(depositor1.address);
        expect(bal2.sub(bal1)).to.equal(BN.from("100000000"));
      })
    });
  }
  */
  interface Balances {
    userUsdt: BN;
    userWaUsdt: BN;
    waUsdtUsdt: BN;
  }

  async function getBalances(user: Wallet): Promise<Balances> {
    return {
      userUsdt: await usdt.balanceOf(user.address),
      userWaUsdt: await waUsdt.balanceOf(user.address),
      waUsdtUsdt: await usdt.balanceOf(waUsdt.address)
    };
  }

  function getBalancesDiff(balances1: Balances, balances2: Balances): Balances {
    return {
      userUsdt: balances1.userUsdt.sub(balances2.userUsdt),
      userWaUsdt: balances1.userWaUsdt.sub(balances2.userWaUsdt),
      waUsdtUsdt: balances1.waUsdtUsdt.sub(balances2.waUsdtUsdt)
    };
  }
});
