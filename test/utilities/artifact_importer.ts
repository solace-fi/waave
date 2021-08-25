/**
 * Tools such as MythX require contracts to be preprocessed.
 * The main advantage of Artifact Importer is it's ability to seamlessly switch between raw and processed contracts.
 * It also removes repetitive code from the tests.
 */

import { config as dotenv_config } from "dotenv";
dotenv_config();
import { ContractJSON } from "ethereum-waffle/dist/esm/ContractJSON";

export interface ArtifactImports { [contract_name: string]: ContractJSON };

export const EMPTY_ARTIFACTS: ArtifactImports = {};

export async function import_artifacts() {
  let artifacts: ArtifactImports = {};

  let artifact_dir = process.env.USE_PROCESSED_FILES === "true" ? "../../artifacts/contracts_processed" : "../../artifacts/contracts";

  artifacts.WaRegistry = await tryImport(`${artifact_dir}/WaRegistry.sol/WaRegistry.json`);
  artifacts.waToken = await tryImport(`${artifact_dir}/WaToken.sol/WaToken.json`);

  artifacts.WETH = await tryImport(`${artifact_dir}/WETH9.sol/WETH9.json`);
  artifacts.MockERC20 = await tryImport(`${artifact_dir}/mocks/MockERC20.sol/MockERC20.json`);

  artifacts.ERC20 = await tryImport(`${artifact_dir}/WETH9/ERC20.json`);
  if(!artifacts.ERC20) artifacts.ERC20 = await tryImport(`../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json`);

  return artifacts;
}

async function tryImport(filepath: string) {
  try {
    var imp = await import(filepath);
    return imp;
  } catch(e) {
    return undefined;
  }
}
