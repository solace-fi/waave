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

const WAREGISTRY_ADDRESS        = "0x670Fc618C48964F806Cd655600541807ed83a9C5";
const WETH_ADDRESS              = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const WAWETH_ADDRESS            = "0x4e1A6cE8EdEd8c9C74CbF797c6aA0Fbc12D89F71";
const DAI_ADDRESS               = "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa";
const WADAI_ADDRESS             = "0x51758E33047b1199439212cBAf3ecd1C04165bF0";
const BAT_ADDRESS               = "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99";
const WABAT_ADDRESS             = "0x18dC87041956144F3EB1371c9E959e3dcAD528D7";

let artifacts: ArtifactImports;
let waRegistry: WaRegistry;
let weth: Weth9;
let waWeth: WaToken;
let dai: Contract;
let waDai: WaToken;
let bat: Contract;
let waBat: WaToken;

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
  await deployBat();
  await deployWaBat();
  await deployBat();
  await deployWaBat();

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

async function deployBat() {
  if(!!BAT_ADDRESS) {
    bat = (await ethers.getContractAt(artifacts.ERC20.abi, BAT_ADDRESS)) as Contract;
  } else {
    console.log("Deploying BAT");
    bat = (await deployContract(deployer, artifacts.MockERC20, ["Tether USD", "BAT", 6])) as Contract;
    console.log(`Deployed BAT to ${bat.address}`);
    await _verifier(bat.address, ["Tether USD", "BAT", 6]);
  }
}

async function deployWaBat() {
  if(!!WABAT_ADDRESS) {
    waBat = (await ethers.getContractAt(artifacts.waToken.abi, WABAT_ADDRESS)) as WaToken;
  } else {
    console.log("Deploying waBAT");
    waBat = (await deployContract(deployer, artifacts.waToken, [signerAddress, bat.address])) as WaToken;
    console.log(`Deployed waBAT to ${waBat.address}`);
    await _verifier(waBat.address, [signerAddress, bat.address]);
  }
  if(await waRegistry.governance() == signerAddress && !(await waRegistry.isWaToken(waBat.address))) {
    console.log("registering waBAT");
    let tx = await waRegistry.connect(deployer).addToken(waBat.address);
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
  logContractAddress("BAT", bat.address);
  logContractAddress("waBAT", waBat.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
