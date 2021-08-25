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

describe("waDAI", function() {
  let artifacts: ArtifactImports;
  let [deployer, governor, depositor1, depositor2] = provider.getWallets();

  let dai: Contract;
  let waDai: WaToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TEN_ETHER = BN.from("10000000000000000000");

  before(async function() {
    artifacts = await import_artifacts();

    if(process.env.FORK_NETWORK === "mainnet"){
      dai = (await ethers.getContractAt(artifacts.ERC20.abi, "0x6B175474E89094C44Da98b954EedeAC495271d0F")) as Contract;
    } else if(process.env.FORK_NETWORK === "rinkeby"){
      dai = (await ethers.getContractAt(artifacts.ERC20.abi, "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa")) as Contract;
    } else if(process.env.FORK_NETWORK === "kovan"){
      dai = (await ethers.getContractAt(artifacts.ERC20.abi, "0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD")) as Contract;
    } else {
      dai = (await deployContract(deployer, artifacts.MockERC20, ["Dai Stablecoin", "DAI", 18])) as Contract;
    }

    // create underlying positions
    const INITIAL_BALANCE = TEN_ETHER;
    var value = toBytes32(INITIAL_BALANCE).toString();
    for(var j = 0; j < 200; ++j) {
      try { // solidity rigged balanceOf
        var index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[governor.address,j]);
        await setStorageAt(dai.address, index, value);
        var uBalance = await dai.balanceOf(governor.address);
        if(uBalance.eq(INITIAL_BALANCE)) {
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor1.address,j]);
          await setStorageAt(dai.address, index, value);
          index = ethers.utils.solidityKeccak256(["uint256", "uint256"],[depositor2.address,j]);
          await setStorageAt(dai.address, index, value);
          break;
        }
      } catch(e) { }
    }
    expect(await dai.balanceOf(governor.address)).to.equal(INITIAL_BALANCE);
  });

  describe("deployment", async function () {
    it("deploys successfully", async function () {
      waDai = (await deployContract(deployer, artifacts.waToken, [governor.address, dai.address])) as WaToken;
    });
    it("has the right name", async function () {
      let expectedName =
          process.env.FORK_NETWORK === "mainnet" ? "waave Dai Stablecoin"
        : process.env.FORK_NETWORK === "rinkeby" ? "waave Dai"
        : process.env.FORK_NETWORK === "kovan" ? "waave DAI"
        : "waave Dai Stablecoin";
      expect(await waDai.name()).to.equal(expectedName);
    });
    it("has the right symbol", async function () {
      expect(await waDai.symbol()).to.equal("waDAI");
    });
    it("has the right decimals", async function () {
      expect(await waDai.decimals()).to.equal(18);
    });
  })

  describe("governance", function() {
    it("starts with the correct governor", async function() {
      expect(await waDai.governance()).to.equal(governor.address);
    });
    it("rejects setting new governance by non governor", async function() {
      await expect(waDai.connect(depositor1).setGovernance(depositor1.address)).to.be.revertedWith("!governance");
    });
    it("can set new governance", async function() {
      await waDai.connect(governor).setGovernance(depositor1.address);
      expect(await waDai.governance()).to.equal(governor.address);
      expect(await waDai.newGovernance()).to.equal(depositor1.address);
    });
    it("rejects governance transfer by non governor", async function() {
      await expect(waDai.connect(depositor2).acceptGovernance()).to.be.revertedWith("!governance");
    });
    it("can transfer governance", async function() {
      let tx = await waDai.connect(depositor1).acceptGovernance();
      await expect(tx)
        .to.emit(waDai, "GovernanceTransferred")
        .withArgs(depositor1.address);
      expect(await waDai.governance()).to.equal(depositor1.address);
      expect(await waDai.newGovernance()).to.equal(ZERO_ADDRESS);

      await waDai.connect(depositor1).setGovernance(governor.address);
      await waDai.connect(governor).acceptGovernance();
    });
  });

  describe("deposit", function () {
    before(async function () {
      await dai.connect(governor).approve(waDai.address, TEN_ETHER);
      await dai.connect(depositor1).approve(waDai.address, TEN_ETHER);
      await dai.connect(depositor2).approve(waDai.address, TEN_ETHER);
    });
    it("initially mints 1:1", async function () {
      let pps = await waDai.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waDai.decimals()));
      let depositAmount = BN.from("1234000000000000000");
      let bals1 = await getBalances(depositor1);
      await waDai.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaDai).to.equal(depositAmount);
      expect(balDiffs.waDaiDai).to.equal(depositAmount);
      pps = await waDai.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waDai.decimals()));
    });
    it("still mints 1:1", async function () {
      let depositAmount = BN.from("567000000000000000");
      let bals1 = await getBalances(depositor2);
      await waDai.connect(depositor2).deposit(depositAmount);
      let bals2 = await getBalances(depositor2);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaDai).to.equal(depositAmount);
      expect(balDiffs.waDaiDai).to.equal(depositAmount);
      let pps = await waDai.pricePerShare();
      expect(pps).to.equal(BN.from(10).pow(await waDai.decimals()));
    });
    it("mints to maintain price per share", async function () {
      await dai.connect(governor).transfer(waDai.address, "9125347");
      let ts = await waDai.totalSupply();
      let ta = await dai.balanceOf(waDai.address);
      let pps1 = await waDai.pricePerShare();
      expect(pps1).to.be.gt(BN.from(10).pow(await waDai.decimals()));
      let depositAmount = BN.from("987000000000000000");
      let mintAmount = depositAmount.mul(ts).div(ta);
      expect(mintAmount).to.not.equal(depositAmount);
      let bals1 = await getBalances(depositor1);
      await waDai.connect(depositor1).deposit(depositAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(depositAmount.mul(-1));
      expect(balDiffs.userWaDai).to.equal(mintAmount);
      expect(balDiffs.waDaiDai).to.equal(depositAmount);
      let pps2 = await waDai.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    });
  });

  describe("withdraw", function () {
    before(async function () {
      waDai = (await deployContract(deployer, artifacts.waToken, [governor.address, dai.address])) as WaToken;
      await dai.connect(governor).approve(waDai.address, TEN_ETHER);
      await dai.connect(depositor1).approve(waDai.address, TEN_ETHER);
      await dai.connect(depositor2).approve(waDai.address, TEN_ETHER);
      await waDai.connect(depositor1).deposit("12345678901234567");
      await waDai.connect(depositor2).deposit("98746211588955626");
    });
    it("initially burns 1:1", async function () {
      let withdrawAmount = BN.from("151515151515151");
      let bals1 = await getBalances(depositor1);
      await waDai.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(withdrawAmount);
      expect(balDiffs.userWaDai).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waDaiDai).to.equal(withdrawAmount.mul(-1));
    });
    it("burns to maintain price per share", async function () {
      await dai.connect(governor).transfer(waDai.address, "9125347");
      let ts = await waDai.totalSupply();
      let ta = await dai.balanceOf(waDai.address);
      let pps1 = await waDai.pricePerShare();
      let withdrawAmount = BN.from("151515151515151");
      let burnAmount = withdrawAmount.mul(ta).div(ts);
      expect(burnAmount).to.not.equal(withdrawAmount);
      let bals1 = await getBalances(depositor1);
      await waDai.connect(depositor1).withdraw(withdrawAmount);
      let bals2 = await getBalances(depositor1);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(burnAmount);
      expect(balDiffs.userWaDai).to.equal(withdrawAmount.mul(-1));
      expect(balDiffs.waDaiDai).to.equal(burnAmount.mul(-1));
      let pps2 = await waDai.pricePerShare();
      expect(pps2).to.be.closeTo(pps1, 10);
    })
  });

  describe("exploit", async function () {
    it("rejects exploit by non governance", async function () {
      await expect(waDai.connect(depositor1).lose(0)).to.be.revertedWith("!governance");
    });
    it("pulls money from the vault", async function () {
      let pps1 = await waDai.pricePerShare();
      let exploitAmount = (await dai.balanceOf(waDai.address)).div(3);
      let bals1 = await getBalances(governor);
      await waDai.connect(governor).lose(exploitAmount);
      let bals2 = await getBalances(governor);
      let balDiffs = getBalancesDiff(bals2, bals1);
      expect(balDiffs.userDai).to.equal(exploitAmount);
      expect(balDiffs.userWaDai).to.equal(0);
      expect(balDiffs.waDaiDai).to.equal(exploitAmount.mul(-1));
      let pps2 = await waDai.pricePerShare();
      expect(pps2).to.be.lt(pps1);
    });
  });
  /*
  if(process.env.FORK_NETWORK !== "mainnet") {
    describe("mint", function () {
      it("can mint testnet dai", async function () {
        let bal1 = await dai.balanceOf(depositor1.address);
        await dai.connect(depositor1).mint();
        let bal2 = await dai.balanceOf(depositor1.address);
        expect(bal2.sub(bal1)).to.equal(BN.from("100000000000000000000"));
      })
    });
  }
  */
  interface Balances {
    userDai: BN;
    userWaDai: BN;
    waDaiDai: BN;
  }

  async function getBalances(user: Wallet): Promise<Balances> {
    return {
      userDai: await dai.balanceOf(user.address),
      userWaDai: await waDai.balanceOf(user.address),
      waDaiDai: await dai.balanceOf(waDai.address)
    };
  }

  function getBalancesDiff(balances1: Balances, balances2: Balances): Balances {
    return {
      userDai: balances1.userDai.sub(balances2.userDai),
      userWaDai: balances1.userWaDai.sub(balances2.userWaDai),
      waDaiDai: balances1.waDaiDai.sub(balances2.waDaiDai)
    };
  }
});
