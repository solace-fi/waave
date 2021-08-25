// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.6;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./Governable.sol";
import "./interface/IWaRegistry.sol";

/**
 * @title IWaRegistry
 * @author solace.fi
 * @notice Tracks the waTokens.
 */
contract WaRegistry is IWaRegistry, Governable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal _waTokens;

    /**
     * @notice Constructs the WaRegistry contract.
     * @param governance_ The address of the [governor](/docs/user-docs/Governance).
     */
    constructor(address governance_) Governable(governance_) { }

    /**
     * @notice The number of registered waTokens.
     */
    function numTokens() external view override returns (uint256) {
        return _waTokens.length();
    }

    /**
     * @notice Returns true if the account is a waToken.
     */
    function isWaToken(address account) external view override returns (bool) {
        return _waTokens.contains(account);
    }

    /**
     * @notice Gets the waToken at an index [0,numTokens()-1].
     */
    function waTokenAt(uint256 index) external view override returns (address) {
        return _waTokens.at(index);
    }

    /**
     * @notice Gets all waTokens.
     */
    function getAllWaTokens() external view override returns (address[] memory) {
        uint256 tokenCount = _waTokens.length();
        address[] memory tokens = new address[](tokenCount);
        for (uint256 index=0; index < tokenCount; index++) {
            tokens[index] = _waTokens.at(index);
        }
        return tokens;
    }

    /**
     * @notice Registers a new waToken.
     * Can only be called by the current [**governor**](/docs/user-docs/Governance).
     * @param waToken The new waToken.
     */
    function addToken(address waToken) external override onlyGovernance {
        _waTokens.add(waToken);
    }

    /**
     * @notice Deregisters a waToken.
     * Can only be called by the current [**governor**](/docs/user-docs/Governance).
     * @param waToken The waToken.
     */
    function removeToken(address waToken) external override onlyGovernance {
        _waTokens.remove(waToken);
    }
}
