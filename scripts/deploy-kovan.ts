import hardhat from "hardhat";
const { waffle, ethers } = hardhat;
const BN = ethers.BigNumber;
const {  provider, deployContract } = waffle;
import { config as dotenv_config } from "dotenv";
dotenv_config();
const deployer = new ethers.Wallet(JSON.parse(process.env.RINKEBY_ACCOUNTS || '[]')[0], provider);

import { logContractAddress } from "./utils";

import { import_artifacts, ArtifactImports } from "./../test/utilities/artifact_importer";
import { WaRegistry, Weth9, WaToken, MockErc20 } from "../typechain";
import { _verifier } from "./create2Contract";
import { Contract } from "ethers";

const WAREGISTRY_ADDRESS        = "0x166956c3A96c875610DCfb80F228Da0f4e92B73B";
const WETH_ADDRESS              = "0xd0A1E359811322d97991E03f863a0C30C2cF029C";
const WAWETH_ADDRESS            = "0xe0f1cdB8AC8d75Af103b227Ee0aE7c7fd47A4A83";
const DAI_ADDRESS               = "0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD";
const WADAI_ADDRESS             = "0xcc920E61c23f39Ae5AFc7B494E669b975594Eeea";
const USDT_ADDRESS              = "0x13512979ADE267AB5100878E2e0f485B568328a4";
const WAUSDT_ADDRESS            = "0x23887f03647282f4E5305e6Cd877842D76De07a1";
const WBTC_ADDRESS              = "0xD1B98B6607330172f1D991521145A22BCe793277";
const WAWBTC_ADDRESS            = "0x23887f03647282f4E5305e6Cd877842D76De07a1";

let artifacts: ArtifactImports;
let waRegistry: WaRegistry;
let weth: Weth9;
let waWeth: WaToken;
let dai: Contract;
let waDai: WaToken;
let usdt: Contract;
let waUsdt: WaToken;
let wbtc: Contract;
let waWbtc: WaToken;

let signerAddress: string;

async function main() {
  artifacts = await import_artifacts();
  signerAddress = await deployer.getAddress();
  console.log(`Using ${signerAddress} as deployer and governor`);

  if((await provider.getNetwork()).chainId == 31337) {
    console.log('funding')
    var [funder] = await hardhat.ethers.getSigners();
    let tx = await funder.sendTransaction({to: signerAddress, value: BN.from("100000000000000000000")});
    await tx.wait();
  }

  await deployWaRegistry();
  await deployWeth();
  await deployWaWeth();
  await deployDai();
  await deployWaDai();
  await deployUsdt();
  await deployWaUsdt();
  await deployWbtc();
  await deployWaWbtc();

  await logAddresses();
}

async function deployWaRegistry() {
  if(!!WAREGISTRY_ADDRESS) {
    waRegistry = (await ethers.getContractAt(artifacts.WaRegistry.abi, WAREGISTRY_ADDRESS)) as WaRegistry;
  } else {
    console.log("Deploying WaRegistry");
    waRegistry = (await deployContract(deployer, artifacts.WaRegistry, [signerAddress])) as WaRegistry;
    console.log(`Deployed WaRegistry to ${waRegistry.address}`);
    await _verifier(waRegistry.address, [signerAddress]);
  }
}

async function deployWeth() {
  weth = (await ethers.getContractAt(artifacts.WETH.abi, WETH_ADDRESS)) as Weth9;
}

async function deployWaWeth() {
  if(!!WAWETH_ADDRESS) {
    waWeth = (await ethers.getContractAt(artifacts.waToken.abi, WAWETH_ADDRESS)) as WaToken;
  } else {
    console.log("Deploying waWETH");
    waWeth = (await deployContract(deployer, artifacts.waToken, [signerAddress, weth.address])) as WaToken;
    console.log(`Deployed waWETH to ${waWeth.address}`);
    await _verifier(waWeth.address, [signerAddress, weth.address]);
  }
  if(await waRegistry.governance() == signerAddress && !(await waRegistry.isWaToken(waWeth.address))) {
    console.log("registering waWETH");
    let tx = await waRegistry.connect(deployer).addToken(waWeth.address);
    await tx.wait();
  }
}

async function deployDai() {
  if(!!DAI_ADDRESS) {
    dai = (await ethers.getContractAt(artifacts.ERC20.abi, DAI_ADDRESS)) as Contract;
  } else {
    console.log("Deploying DAI");
    dai = (await deployContract(deployer, artifacts.MockERC20, ["Dai Stablecoin", "DAI", 18])) as Contract;
    console.log(`Deployed DAI to ${dai.address}`);
    await _verifier(dai.address, ["Dai Stablecoin", "DAI", 18]);
  }
}

async function deployWaDai() {
  if(!!WADAI_ADDRESS) {
    waDai = (await ethers.getContractAt(artifacts.waToken.abi, WADAI_ADDRESS)) as WaToken;
  } else {
    console.log("Deploying waDAI");
    waDai = (await deployContract(deployer, artifacts.waToken, [signerAddress, dai.address])) as WaToken;
    console.log(`Deployed waDAI to ${waDai.address}`);
    await _verifier(waDai.address, [signerAddress, dai.address]);
  }
  if(await waRegistry.governance() == signerAddress && !(await waRegistry.isWaToken(waDai.address))) {
    console.log("registering waDAI");
    let tx = await waRegistry.connect(deployer).addToken(waDai.address);
    await tx.wait();
  }
}

async function deployUsdt() {
  if(!!USDT_ADDRESS) {
    usdt = (await ethers.getContractAt(artifacts.ERC20.abi, USDT_ADDRESS)) as Contract;
  } else {
    console.log("Deploying USDT");
    usdt = (await deployContract(deployer, artifacts.MockERC20, ["Tether USD", "USDT", 6])) as Contract;
    console.log(`Deployed USDT to ${usdt.address}`);
    await _verifier(usdt.address, ["Tether USD", "USDT", 6]);
  }
}

async function deployWaUsdt() {
  if(!!WAUSDT_ADDRESS) {
    waUsdt = (await ethers.getContractAt(artifacts.waToken.abi, WAUSDT_ADDRESS)) as WaToken;
  } else {
    console.log("Deploying waUSDT");
    waUsdt = (await deployContract(deployer, artifacts.waToken, [signerAddress, usdt.address])) as WaToken;
    console.log(`Deployed waUSDT to ${waUsdt.address}`);
    await _verifier(waUsdt.address, [signerAddress, usdt.address]);
  }
  if(await waRegistry.governance() == signerAddress && !(await waRegistry.isWaToken(waUsdt.address))) {
    console.log("registering waUSDT");
    let tx = await waRegistry.connect(deployer).addToken(waUsdt.address);
    await tx.wait();
  }
}

async function deployWbtc() {
  if(!!WBTC_ADDRESS) {
    wbtc = (await ethers.getContractAt(artifacts.ERC20.abi, WBTC_ADDRESS)) as Contract;
  } else {
    console.log("Deploying WBTC");
    wbtc = (await deployContract(deployer, artifacts.MockERC20, ["Tether USD", "WBTC", 6])) as Contract;
    console.log(`Deployed WBTC to ${wbtc.address}`);
    await _verifier(wbtc.address, ["Tether USD", "WBTC", 6]);
  }
}

async function deployWaWbtc() {
  if(!!WAWBTC_ADDRESS) {
    waWbtc = (await ethers.getContractAt(artifacts.waToken.abi, WAWBTC_ADDRESS)) as WaToken;
  } else {
    console.log("Deploying waWBTC");
    waWbtc = (await deployContract(deployer, artifacts.waToken, [signerAddress, wbtc.address])) as WaToken;
    console.log(`Deployed waWBTC to ${waWbtc.address}`);
    await _verifier(waWbtc.address, [signerAddress, wbtc.address]);
  }
  if(await waRegistry.governance() == signerAddress && !(await waRegistry.isWaToken(waWbtc.address))) {
    console.log("registering waWBTC");
    let tx = await waRegistry.connect(deployer).addToken(waWbtc.address);
    await tx.wait();
  }
}

async function logAddresses() {
  console.log("")
  logContractAddress("Contract Name", "Address")
  console.log("-------------------------------------------------------------");
  logContractAddress("WaRegistry", waRegistry.address);
  logContractAddress("WETH", weth.address);
  logContractAddress("waWETH", waWeth.address);
  logContractAddress("DAI", dai.address);
  logContractAddress("waDAI", waDai.address);
  logContractAddress("USDT", usdt.address);
  logContractAddress("waUSDT", waUsdt.address);
  logContractAddress("WBTC", usdt.address);
  logContractAddress("waWBTC", waUsdt.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
