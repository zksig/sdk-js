import type { Agreement, Profile } from "./types";
import type { ZKsigAgreement } from "./ZKsigAgreement";
import { constants, Contract, Signer, VoidSigner } from "ethers";
import { UnixFS } from "ipfs-unixfs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as codec from "@ipld/dag-pb";
import DigitalSignature from "./abi/DigitalSignature.json";
import { encryptAgreementAndPin, pinFile } from "./files";

export type ZKsigDigitalSignatureContractOptions = {
  /**
   * Optional. Smart contract address to connect to. Use `chainId`
   * to automatically find the contract address
   */
  address?: string;
  /**
   * Chain Id to interact with. If provided will automatically find
   * the proper contract address
   */
  chainId?: number;
  /**
   * Ether `Signer`. This must be provider in the constructor or
   * with `setSigner` before interact with the smart contract.
   */
  signer?: Signer;
};

const contractAddresses: Record<string, string> = {
  80001: "0xf08b4ddA8581FcA449A58d4225D804043B71AA5c",
  11155111: "0x18Aa4DCADdC1B3df2BbEBfB99407CDfa4b7282A9",
  31415: "0x0C8a04faB35dc3239AC4e88F26903CF46Bd0bA47",
};

/**
 * Connect to and interact with the ZKsig DigitalSignature
 * smart contract.
 *
 * @example
 * ```typescript
 * const provider = new providers.Web3Provider(window.ethereum);
 * const signer = provider.getSigner();
 *
 * const contract = new ZKsigDigitalSignatureContract({
 *   chainId: await signer.getChainId(),
 *   signer,
 * });
 * const agreements = await contract.getAgreements({
 *   page: 1,
 *   perPage: 10,
 * });
 * ```
 */
export class ZKsigDigitalSignatureContract {
  private _contractAddress: string;
  private _contract: Contract;

  constructor(options: ZKsigDigitalSignatureContractOptions) {
    if (options.address) {
      this._contractAddress = options.address;
    } else {
      this._contractAddress = contractAddresses[options.chainId];
    }

    if (!this._contractAddress) {
      throw new Error(
        `Unable to initialize ZKsigDigitalSignatureContract. Invalid chainId ${options.chainId}`
      );
    }

    this._contract = new Contract(
      this._contractAddress,
      DigitalSignature.abi,
      options.signer
    );
  }

  /**
   * Set the signer for transactions sent to the ZKsig DigitalSignature
   * smart contract.
   *
   * @param signer Ether `Signer` to use when signing transactions
   */
  setSigner(signer: Signer) {
    this._contract.connect(signer);
  }

  /**
   * Get the connected signers ZKsig profile.
   */
  getProfile(): Promise<Profile> {
    this._readyCheck();
    return this._contract.getProfile();
  }

  /**
   * Get a list of agreements for the `address` or (if not provided)
   * for the `signer`.
   *
   * @param options.address Optional. If not provided defaults to the `signer` address
   */
  async getAgreements({
    address,
    page,
    perPage,
  }: {
    address?: string;
    page: number;
    perPage: number;
  }): Promise<Agreement[]> {
    this._readyCheck();
    return this._contract.getAgreements(
      address || (await this._contract.signer.getAddress()),
      (page - 1) * perPage,
      perPage
    );
  }

  /**
   * Get an agreements for the `address` or (if not provided)
   * for the `signer`.
   *
   * @param options.address Optional. If not provided defaults to the `signer` address
   * @param options.index The index of the agreement to fetch
   */
  async getAgreement({ address, index }: { address?: string; index: number }) {
    this._readyCheck();
    const [agreement] = await this.getAgreements({
      address,
      page: index + 1,
      perPage: 1,
    });
    
    return agreement;
  }

  /**
   * Get a list of signatures for the `address` or (if not provided)
   * for the `signer`.
   *
   * @param options.address Optional. If not provided defaults to the `signer` address
   */
  async getSignatures({
    address,
    page,
    perPage,
  }: {
    address?: string;
    page: number;
    perPage: number;
  }) {
    this._readyCheck();
    return this._contract.getSignatures(
      address || (await this._contract.signer.getAddress()),
      (page - 1) * perPage,
      perPage
    );
  }

  /**
   * Get a signature for the `address` or (if not provided)
   * for the `signer`.
   *
   * @param options.address Optional. If not provided defaults to the `signer` address
   * @param options.index The index of the signature to fetch
   */
  async getSignature({ address, index }: { address?: string; index: number }) {
    this._readyCheck();
    const [signature] = await this.getSignatures({
      address,
      page: index + 1,
      perPage: 1,
    });
    return signature;
  }

  /**
   * Create a new ZKsig legally binding agreement.
   *
   * {@link ZKsigAgreement.createOnChain}
   */
  async createAgreement(agreement: ZKsigAgreement) {
    this._readyCheck();
    const [address, pw, pdf] = await Promise.all([
      this._contract.signer.getAddress(),
      this._contract.signer.signMessage(
        `Encrypt PDF for ${agreement.getIdentifier()}`
      ),
      agreement.toBytes(),
    ]);

    const data = new UnixFS({ type: "file", data: pdf });
    const cid = CID.create(
      0,
      codec.code,
      await sha256.digest(codec.encode({ Data: data.marshal(), Links: [] }))
    );

    const constraints = agreement
      .getDescription()
      .map(({ identifier, allowedToUse, signer }) => ({
        identifier,
        allowedToUse,
        signer: signer || constants.AddressZero,
        totalUsed: 0,
      }));

    const [encryptedCid, descriptionCid] = await Promise.all([
      encryptAgreementAndPin({
        pdf,
        name: `${address} - ${agreement.getIdentifier()}`,
        encryptionPWBytes: Buffer.from(pw),
      }),
      pinFile({
        file: Buffer.from(JSON.stringify(agreement.getDescription())),
        name: `Description: ${address} - ${agreement.getIdentifier()}`,
      }),
    ]);

    return this._contract.createAgreement({
      identifier: agreement.getIdentifier(),
      cid: cid.toV1().toString(),
      encryptedCid,
      descriptionCid,
      constraints,
      agreementCallback: constants.AddressZero,
      signatureCallback: constants.AddressZero,
      extraInfo: Buffer.from(""),
    });
  }

  /**
   * Create a new ZKsig legally binding digital signature attached to an agreement.
   */
  async sign({
    agreement,
    identifier,
    pdf,
  }: {
    agreement: Agreement;
    identifier: string;
    pdf: Uint8Array;
  }) {
    this._readyCheck();

    const signer = this._contract.signer;
    const [address, pw] = await Promise.all([
      signer.getAddress(),
      (signer as VoidSigner)._signTypedData(
        {},
        {
          AgreementSigner: [
            { name: "Owner Address", type: "address" },
            { name: "Agreement Identifier", type: "string" },
            { name: "Agreement Index", type: "uint256" },
            { name: "Signer Identifier", type: "string" },
          ],
        },
        {
          "Owner Address": agreement.owner,
          "Agreement Identifier": agreement.identifier,
          "Agreement Index": agreement.index,
          "Signer Identifier": identifier,
        }
      ),
    ]);

    const encryptedCid = await encryptAgreementAndPin({
      pdf,
      name: `Signature - ${address} - ${identifier} on ${agreement.identifier}`,
      encryptionPWBytes: Buffer.from(pw),
    });

    return this._contract.sign({
      identifier,
      encryptedCid,
      agreementOwner: agreement.owner,
      agreementIndex: agreement.index,
      extraInfo: Buffer.from(""),
    });
  }

  private _readyCheck() {
    if (!this._contract.signer) {
      throw new Error(
        "Use `setSigner` to set an ethers Signer before using contract"
      );
    }
  }
}
