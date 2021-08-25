# Performs a fresh install of all packages then
# performs a fresh compile and test of all contracts.

# clean filesystem
rm -rf artifacts
rm -rf cache
rm -rf client
rm -rf typechain
rm -rf contracts_processed
rm -rf node_modules
rm -rf coverage
rm coverage.json

# install packages. process, compile, and test contracts
npm install
python3 scripts/process_contracts.py
npx hardhat compile
npx hardhat test

# code coverage
npx hardhat coverage

# docs
#npx solidity-docgen --solc-module solc-0.8 -o docs/_build/md

# misc
solhint contracts/**/*.sol
npm outdated
