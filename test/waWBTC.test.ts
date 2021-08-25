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

describe("waWBTC", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, depositor1, depositor2] = provider.getWallets();

  let wbtc: Contract;
  let waWbtc: WaToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TEN_ETHER = BN.from("10000000000000000000");

  before(async function() {
    artifacts = await import_artifacts();

    if(process.env.FORK_NETWORK === "mainnet") {
      wbtc = (await ethers.getContractAt(artifacts.ERC20.abi, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599")) as Contract;
    } else if(process.env.FORK_NETWORK === "rinkeby") {
      wbtc = (await deployContract(deployer, artifacts.MockERC20, ["Wrapped BTC", "WBTC", 8])) as Contract;
    } else if(process.env.FORK_NETWORK === "kovan") {
      wbtc = (await ethers.getContractAt(artifacts.ERC20.abi, "0xD1B98B6607330172f1D991521145A22BCe793277")) as Contract;
    } else {
      wbtc = (await deployContract(deployer, artifacts.MockERC20, ["Wrapped BTC", "WBTC", 8])) as Contract;
    }

    // create underlying positions
    const INITIAL_BALANCE = TEN_ETHER;
    var value = toBytes32(INITIAL_BALANCE).toString();
    for(var j = 0; j < 200; ++j) {
      try { // solidity rigged balanceOf
        var index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[governor.address,j]);
        await setStorageAt(wbtc.address, index, value);
        var uBalance = await wbtc.balanceOf(governor.address);
        if(uBalance.eq(INITIAL_BALANCE)) {
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor1.address,j]);
          await setStorageAt(wbtc.address, index, value);
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor2.address,j]);
          await setStorageAt(wbtc.address, index, value);
          break;
        }
      } catch(e) { }
    }
    expect(await wbtc.balanceOf(governor.address)).to.equal(INITIAL_BALANCE);
  });

  describe("deployment", async function () {
    it("deploys successfully", async function () {
      waWbtc = (await deployContract(deployer, artifacts.waToken, [governor.address, wbtc.address])) as WaToken;
    });
    it("has the right name", async function () {
      let expectedName =
          process.env.FORK_NETWORK === "mainnet" ? "waave Wrapped BTC"
        : process.env.FORK_NETWORK === "rinkeby" ? "waave Wrapped BTC"
        : process.env.FORK_NETWORK === "kovan" ? "waave WBTC"
        : "waave Wrapped BTC";
      expect(await waWbtc.name()).to.equal(expectedName);
    });
    it("has the right symbol", async function () {
      expect(await waWbtc.symbol()).to.equal("waWBTC");
    });
    it("has the right decimals", async function () {
      expect(await waWbtc.decimals()).to.equal(8);
    });
  })

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waWbtc.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waWbtc.connect(depositor1).setGovernance(depositor1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waWbtc.connect(governor).setGovernance(depositor1.address);
      expect(await waWbtc.governance()).to.equal(governor.address);
      expect(await waWbtc.newGovernance()).to.equal(depositor1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waWbtc.connect(depositor2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waWbtc.connect(depositor1).acceptGovernance();
      await expect(tx)
        .to.emit(waWbtc, "GovernanceTransferred")
        .withArgs(depositor1.address);
      expect(await waWbtc.governance()).to.equal(depositor1.address);
      expect(await waWbtc.newGovernance()).to.equal(ZERO_ADDRESS);

      await waWbtc.connect(depositor1).setGovernance(governor.address);
      await waWbtc.connect(governor).acceptGovernance();
    });
  });

  describe("deposit", function () {
    before(async function () {
      await wbtc.connect(governor).approve(waWbtc.address, TEN_ETHER);
      await wbtc.connect(depositor1).approve(waWbtc.address, TEN_ETHER);
      await wbtc.connect(depositor2).approve(waWbtc.address, TEN_ETHER);
    });
    it("initially mints 1:1", async function () {
      let pps = await waWbtc.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWbtc.decimals()));
      let depositAmount = BN.from("123400000");
      let bals1 = await getBalances(depositor1);
      await waWbtc.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWbtc).to.equal(depositAmount);
      expect(balDiffs.waWbtcWbtc).to.equal(depositAmount);
      pps = await waWbtc.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWbtc.decimals()));
    });
    it("still mints 1:1", async function () {
      let depositAmount = BN.from("56700000");
      let bals1 = await getBalances(depositor2);
      await waWbtc.connect(depositor2).deposit(depositAmount);
      let bals2 = await getBalances(depositor2);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWbtc).to.equal(depositAmount);
      expect(balDiffs.waWbtcWbtc).to.equal(depositAmount);
      let pps = await waWbtc.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waWbtc.decimals()));
    });
    it("mints to maintain price per share", async function () {
      await wbtc.connect(governor).transfer(waWbtc.address, "9125347");
      let ts = await waWbtc.totalSupply();
      let ta = await wbtc.balanceOf(waWbtc.address);
      let pps1 = await waWbtc.pricePerShare();
      expect(pps1).to.be.gt(BN.from(10).pow(await waWbtc.decimals()));
      let depositAmount = BN.from("98700000");
      let mintAmount = depositAmount.mul(ts).div(ta);
      expect(mintAmount).to.not.equal(depositAmount);
      let bals1 = await getBalances(depositor1);
      await waWbtc.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaWbtc).to.equal(mintAmount);
      expect(balDiffs.waWbtcWbtc).to.equal(depositAmount);
      let pps2 = await waWbtc.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    });
  });

  describe("withdraw", function () {
    before(async function () {
      waWbtc = (await deployContract(deployer, artifacts.waToken, [governor.address, wbtc.address])) as WaToken;
      await wbtc.connect(governor).approve(waWbtc.address, TEN_ETHER);
      await wbtc.connect(depositor1).approve(waWbtc.address, TEN_ETHER);
      await wbtc.connect(depositor2).approve(waWbtc.address, TEN_ETHER);
      await waWbtc.connect(depositor1).deposit("1234567");
      await waWbtc.connect(depositor2).deposit("9874621");
    });
    it("initially burns 1:1", async function () {
      let withdrawAmount = BN.from("15151");
      let bals1 = await getBalances(depositor1);
      await waWbtc.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(withdrawAmount);
      expect(balDiffs.userWaWbtc).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waWbtcWbtc).to.equal(withdrawAmount.mul(-1));
    });
    it("burns to maintain price per share", async function () {
      await wbtc.connect(governor).transfer(waWbtc.address, "9125347");
      let ts = await waWbtc.totalSupply();
      let ta = await wbtc.balanceOf(waWbtc.address);
      let pps1 = await waWbtc.pricePerShare();
      let withdrawAmount = BN.from("15151");
      let burnAmount = withdrawAmount.mul(ta).div(ts);
      expect(burnAmount).to.not.equal(withdrawAmount);
      let bals1 = await getBalances(depositor1);
      await waWbtc.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(burnAmount);
      expect(balDiffs.userWaWbtc).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waWbtcWbtc).to.equal(burnAmount.mul(-1));
      let pps2 = await waWbtc.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    })
  });

  describe("exploit", async function () {
    it("rejects exploit by non governance", async function () {
      await expect(waWbtc.connect(depositor1).lose(0)).to.be.revertedWith("!governance");
    });
    it("pulls money from the vault", async function () {
      let pps1 = await waWbtc.pricePerShare();
      let exploitAmount = (await wbtc.balanceOf(waWbtc.address)).div(3);
      let bals1 = await getBalances(governor);
      await waWbtc.connect(governor).lose(exploitAmount);
      let bals2 = await getBalances(governor);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userWbtc).to.equal(exploitAmount);
      expect(balDiffs.userWaWbtc).to.equal(0);
      expect(balDiffs.waWbtcWbtc).to.equal(exploitAmount.mul(-1));
      let pps2 = await waWbtc.pricePerShare();
      expect(pps2).to.be.lt(pps1);
    });
  });
  /*
  if(process.env.FORK_NETWORK !== "mainnet") {
    describe("mint", function () {
      it("can mint testnet wbtc", async function () {
        let bal1 = await wbtc.balanceOf(depositor1.address);
        await wbtc.connect(depositor1).mint();
        let bal2 = await wbtc.balanceOf(depositor1.address);
        expect(bal2.sub(bal1)).to.equal(BN.from("10000000000"));
      })
    });
  }
  */
  interface Balances {
    userWbtc: BN;
    userWaWbtc: BN;
    waWbtcWbtc: BN;
  }

  async function getBalances(user: Wallet): Promise<Balances> {
    return {
      userWbtc: await wbtc.balanceOf(user.address),
      userWaWbtc: await waWbtc.balanceOf(user.address),
      waWbtcWbtc: await wbtc.balanceOf(waWbtc.address)
    };
  }

  function getBalancesDiff(balances1: Balances, balances2: Balances): Balances {
    return {
      userWbtc: balances1.userWbtc.sub(balances2.userWbtc),
      userWaWbtc: balances1.userWaWbtc.sub(balances2.userWaWbtc),
      waWbtcWbtc: balances1.waWbtcWbtc.sub(balances2.waWbtcWbtc)
    };
  }
});
