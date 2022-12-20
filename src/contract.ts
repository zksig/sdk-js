import type { Profile, Agreement, SignaturePacket } from "./types";
import { Contract, providers, Signer, constants } from "ethers";
import { UnixFS } from "ipfs-unixfs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as codec from "@ipld/dag-pb";
import DigitalSignature from "./abi/DigitalSignature.json";
import { encryptAgreementAndPin, pinFile } from "./files";

export type WithProvider = {
  provider: providers.BaseProvider;
};

export type WithSigner = {
  signer: Signer;
};

export type GetListOptions = WithProvider & {
  address: string;
  page: number;
  perPage?: number;
};

export type GetOptions = WithProvider & {
  address: string;
  index: number;
};

export type CreateAgreementOptions = WithSigner & {
  identifier: string;
  pdf: Uint8Array;
  description: { identifier: string; fields: string[] }[];
};

export type SignOptions = WithSigner & {
  agreement: Agreement;
  identifier: string;
  pdf: Uint8Array;
};

const getContractWithProvider = (provider: providers.BaseProvider) => {
  const contract = new Contract("", DigitalSignature.abi);
  return contract.connect(provider);
};

const getContractWithSigner = (signer: Signer) => {
  const contract = new Contract("", DigitalSignature.abi);
  return contract.connect(signer);
};

/**
 * Get the connected users ZKsig profile.
 *
 * @param options
 */
export const getProfile = ({ signer }: WithSigner): Promise<Profile> => {
  const contract = getContractWithSigner(signer);
  return contract.getProfile();
};

/**
 * Get a list of legally binding ZKsig agreements for an address.
 *
 * @param options
 */
export const getAgreements = ({
  provider,
  address,
  page,
  perPage = 10,
}: GetListOptions): Promise<Agreement[]> => {
  const contract = getContractWithProvider(provider);
  return contract.getAgreements(address, (page - 1) * perPage, perPage);
};

/**
 * Get a legally binding ZKsig agreement for an address by index.
 *
 * @param options
 */
export const getAgreement = async ({
  provider,
  address,
  index,
}: GetOptions) => {
  const [agreement] = await getAgreements({
    provider,
    address,
    page: index + 1,
    perPage: 1,
  });
  return agreement;
};

/**
 * Get a list of legally binding ZKsig digital signatures for an address.
 *
 * @param options
 */
export const getSignatures = ({
  provider,
  address,
  page,
  perPage = 10,
}: GetListOptions): Promise<SignaturePacket[]> => {
  const contract = getContractWithProvider(provider);
  return contract.getSignatures(address, (page - 1) * perPage, perPage);
};

/**
 * Get a legally binding ZKsig digital signature for an address by index.
 *
 * @param options
 */
export const getSignature = async ({
  provider,
  address,
  index,
}: GetOptions) => {
  const [signature] = await getSignatures({
    provider,
    address,
    page: index + 1,
    perPage: 1,
  });
  return signature;
};

/**
 * Create a new ZKsig legally binding agreement.
 *
 * @param options
 */
export const createAgreement = async ({
  signer,
  identifier,
  pdf,
  description,
}: CreateAgreementOptions) => {
  const contract = getContractWithSigner(signer);

  const address = await signer.getAddress();

  const pw = Buffer.from(
    await signer.signMessage(`Encrypt PDF for ${identifier}`)
  );

  const data = new UnixFS({ type: "file", data: pdf });
  const cid = CID.create(
    0,
    codec.code,
    await sha256.digest(codec.encode({ Data: data.marshal(), Links: [] }))
  );

  const constraints = description.map(({ identifier }) => ({
    identifier,
    signer: constants.AddressZero,
    totalUsed: 0,
    allowedToUse: 1,
  }));

  const [encryptedCid, descriptionCid] = await Promise.all([
    encryptAgreementAndPin({
      pdf,
      name: `${address} - ${identifier}`,
      encryptionPWBytes: pw,
    }),
    pinFile({
      file: Buffer.from(JSON.stringify(description)),
      name: `Description: ${address} - ${identifier}`,
    }),
  ]);

  return contract
    .createAgreement({
      identifier,
      cid: cid.toV1().toString(),
      encryptedCid,
      descriptionCid,
      constraints,
      agreementCallback: constants.AddressZero,
      signatureCallback: constants.AddressZero,
      extraInfo: Buffer.from(""),
    })
    .wait(1);
};

/**
 * Create a new ZKsig legally binding digital signature attached to an agreement.
 *
 * @param options
 */
export const sign = async ({
  signer,
  agreement,
  identifier,
  pdf,
}: SignOptions) => {
  const contract = getContractWithSigner(signer);

  const address = await signer.getAddress();
  const pw = Buffer.from(
    await signer.signMessage(`Encrypt PDF for ${identifier}`)
  );

  const encryptedCid = await encryptAgreementAndPin({
    pdf,
    name: `${address} - ${identifier}`,
    encryptionPWBytes: pw,
  });

  return contract
    .sign({
      identifier,
      encryptedCid,
      agreementOwner: agreement.owner,
      agreementIndex: agreement.index,
      extraInfo: Buffer.from(""),
    })
    .wait(1);
};
