// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./Governable.sol";
import "./interface/IWaToken.sol";

/**
 * @title IWaToken
 * @author solace.fi
 * @notice WaTokens mimic Aave V2 Vaults and can be exploited by design. Use this contract or any of its subclasses at your own risk.
 */
contract WaToken is IWaToken, ERC20Permit, Governable {
    using SafeERC20 for IERC20;
    using Address for address;

    ERC20 internal _underlying;

    /**
     * @notice Constructs the WaToken contract.
     * @param governance_ The address of the [governor](/docs/user-docs/Governance).
     * @param underlying_ The address of the underlying token.
     */
    constructor(address governance_, address underlying_)
        ERC20(
            string(abi.encodePacked("waave ", ERC20(underlying_).name())),
            string(abi.encodePacked("wa", ERC20(underlying_).symbol()))
        )
        ERC20Permit(string(abi.encodePacked("waave ", ERC20(underlying_).name())))
        Governable(governance_)
    {
        _underlying = ERC20(underlying_);
    }

    function decimals() public view override(ERC20, IERC20Metadata) returns (uint8) {
      return _underlying.decimals();
    }

    /**
     * @notice The underlying token.
     */
    function underlying() external view override returns (address) {
        return address(_underlying);
    }

    /**
     * @notice The amount of underlying tokens it would take to mint one full waToken.
     */
    function pricePerShare() external view override returns (uint256) {
      return (totalSupply() == 0 || _totalAssets() == 0)
          ? (10**decimals()) // 1:1
          : (((10**decimals()) * _totalAssets()) / totalSupply()); // maintain ratio
    }

    /**
     * @notice Deposit underlying tokens to receive some waTokens.
     * @param uAmount Amount of underlying to deposit.
     * @return waAmount Amount of waTokens minted.
     */
    function deposit(uint256 uAmount) external override returns (uint256 waAmount) {
        uint256 ts = totalSupply();
        uint256 ta = _totalAssets();
        // pull uTokens
        SafeERC20.safeTransferFrom(_underlying, msg.sender, address(this), uAmount);
        // mint waTokens
        waAmount = (ts == 0 || ta == 0)
          ? uAmount
          : (uAmount * ts / ta);
        _mint(msg.sender, waAmount);
        return waAmount;
    }

    /**
     * @notice Burn some waTokens to receive some underlying tokens.
     * @param waAmount Amount of waTokens to burn.
     * @return uAmount Amount of underlying received.
     */
    function withdraw(uint256 waAmount) external override returns (uint256 uAmount) {
        require(waAmount <= balanceOf(msg.sender), "cannot redeem more shares than you own");
        uAmount = _shareValue(waAmount);
        // burn waTokens
        _burn(msg.sender, waAmount);
        // return uTokens
        SafeERC20.safeTransfer(_underlying, msg.sender, uAmount);
        return uAmount;
    }

    /**
     * @notice The waToken has lost money on its investments.
     * Can only be called by the current [**governor**](/docs/user-docs/Governance).
     * @param uAmount Amount of losses in underlying.
     */
    function lose(uint256 uAmount) external override onlyGovernance {
        SafeERC20.safeTransfer(_underlying, msg.sender, uAmount);
    }

    function _totalAssets() internal view returns (uint256) {
        return _underlying.balanceOf(address(this));
    }

    function _shareValue(uint256 waAmount) internal view returns (uint256 uAmount) {
        uint256 ts = totalSupply();
        uint256 ta = _totalAssets();
        return (ts == 0 || ta == 0)
            ? 0
            : ((waAmount * ta) / ts);
    }
}
