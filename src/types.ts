import type { BigNumber } from "ethers";

export type Profile = {
  totalAgreements: BigNumber;
  totalSignatures: BigNumber;
};

export type SignatureConstraint = {
  identifier: string;
  signer: string;
  totalUsed: BigNumber;
  allowedToUse: BigNumber; // set to 0 for unlimited
};

export type Agreement = {
  owner: string;
  status: number;
  index: BigNumber;
  identifier: string;
  cid: string;
  encryptedCid: string;
  descriptionCid: string;
  signedPackets: number;
  totalPackets: number;
  constraints: SignatureConstraint[];
  agreementCallback: string;
  signatureCallback: string;
};

export type SignaturePacket = {
  agreementOwner: string;
  agreementIndex: BigNumber;
  index: BigNumber;
  identifier: string;
  encryptedCid: string;
  signer: string;
  timestamp: number;
  blockNumber: number;
};
