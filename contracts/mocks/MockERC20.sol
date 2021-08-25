// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title Mock ERC-20
 * @author solace.fi
 * @notice Mock ERC-20 is only used to test the master contract.
 */
contract MockERC20 is ERC20 {
    using SafeERC20 for IERC20;

    uint8 private _decimals;

    /**
     * @notice Constructs the Mock Token contract.
     * @param name The name of the token.
     * @param symbol The symbol of the token.
     * @param decimals The decimals of the token.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol) {
        _decimals = decimals;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint() external returns (uint256 amount) {
        amount = 100 * 10 ** _decimals;
        _mint(msg.sender, amount);
        return amount;
    }
}
