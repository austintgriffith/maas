// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "./MultiSigWallet.sol";

contract MultiSigFactory {
    MultiSigWallet[] public multiSigs;
    mapping(address => bool) existsMultiSig;

  event Create(
    uint indexed contractId,
    address indexed contractAddress,
    address creator,
    address[] owners,
    uint signaturesRequired
  );

    event Create2Event(
        uint256 indexed contractId,
        string name,
        address indexed contractAddress,
        address creator,
        address[] owners,
        uint256 signaturesRequired
    );


    event Owners(
        address indexed contractAddress,
        address[] owners,
        uint256 indexed signaturesRequired
    );


  constructor() {}

  modifier onlyRegistered() {
    require(existsMultiSig[msg.sender], "caller not registered to use logger");
    _;
  }

  function emitOwners(
    address _contractAddress,
    address[] memory _owners,
    uint256 _signaturesRequired
  ) external onlyRegistered {
    emit Owners(_contractAddress, _owners, _signaturesRequired);
  }

  function numberOfMultiSigs() public view returns(uint) {
    return multiSigs.length;
  }

  function getMultiSig(uint256 _index)
    public
    view
    returns (
      address multiSigAddress,
      uint signaturesRequired,
      uint balance
    ) {
      MultiSigWallet multiSig = multiSigs[_index];
      return (address(multiSig), multiSig.signaturesRequired(), address(multiSig).balance);
    }

// naim create2 implimentation
    function create2(
        uint256 _chainId,
        address[] memory _owners,
        uint256 _signaturesRequired,
        bytes32 _salt,
        string memory _name
    ) public payable {
        uint256 id = numberOfMultiSigs();

        /**----------------------
         * create2 implementation
         * ---------------------*/
        address multiSig_address = payable(
            Create2.deploy(
                msg.value,
                _salt,
                abi.encodePacked(
                    type(MultiSigWallet).creationCode,
                    abi.encode(_name, address(this), _chainId, _owners, _signaturesRequired)
                )
            )
        );

        MultiSigWallet multiSig = MultiSigWallet(payable(multiSig_address));

        multiSigs.push(multiSig);
        existsMultiSig[address(multiSig_address)] = true;

        emit Create2Event(
            id,
            _name,
            address(multiSig),
            msg.sender,
            _owners,
            _signaturesRequired
        );
        emit Owners(address(multiSig), _owners, _signaturesRequired);
    }

    /**----------------------
     * get a computed address
     * ---------------------*/
    function computedAddress(
        uint256 _chainId,
        address[] memory _owners,
        uint256 _signaturesRequired,
        bytes32 _salt,
        string memory _name
    )
        public
        view
        returns (address)
    {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(MultiSigWallet).creationCode,
                abi.encode(_name, address(this), _chainId, _owners, _signaturesRequired)
            )
        );
        address computed_address = Create2.computeAddress(_salt, bytecodeHash);

        return computed_address;
    }


}
