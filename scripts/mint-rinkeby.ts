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
import { constants, Contract } from "ethers";

const WAREGISTRY_ADDRESS        = "0x670Fc618C48964F806Cd655600541807ed83a9C5";

let artifacts: ArtifactImports;

let signerAddress: string;

async function main() {
  artifacts = await import_artifacts();
  signerAddress = await deployer.getAddress();
  console.log(`minting tokens for ${signerAddress}`);

  if((await provider.getNetwork()).chainId == 31337) {
    console.log('funding')
    var [funder] = await hardhat.ethers.getSigners();
    let tx = await funder.sendTransaction({to: signerAddress, value: BN.from("100000000000000000000")});
    await tx.wait();
  }

  let waRegistry = (await ethers.getContractAt(artifacts.WaRegistry.abi, WAREGISTRY_ADDRESS)) as WaRegistry;
  let watokens = await waRegistry.getAllWaTokens();
  console.log('tokens:', watokens, '\n\n');
  for(var i = 0; i < watokens.length; ++i) {
    let watokenAddress = watokens[i];
    let watoken = await ethers.getContractAt(artifacts.waToken.abi, watokenAddress);
    let wasymbol = await watoken.symbol();
    console.log(wasymbol);
    let utokenAddress = await watoken.underlying();
    let utoken = await ethers.getContractAt(artifacts.ERC20.abi, utokenAddress);
    let ubalance = await utoken.balanceOf(signerAddress);
    let uallowance = await utoken.allowance(signerAddress, watokenAddress);
    if(uallowance.eq(0) || uallowance.lt(ubalance)) {
      console.log('approving');
      let tx1 = await utoken.connect(deployer).approve(watokenAddress, constants.MaxUint256);
      await tx1.wait();
    }
    if(ubalance.gt(0)) {
      console.log('minting');
      let tx2 = await watoken.connect(deployer).deposit(ubalance);
      await tx2.wait();
    }
    let wabalance = await watoken.balanceOf(signerAddress);
    console.log(`balance: ${wabalance}`);
    console.log('\n');
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
