import { VoidSigner } from "ethers";
import { Agreement } from "./types";

const domain = {
  name: "ZKsig Digital Signatures",
  version: "1",
};

const encryptionTypes = {
  Agreement: [
    { name: "Owner Address", type: "address" },
    { name: "Agreement Identifier", type: "string" },
    { name: "CID", type: "string" },
  ],
};

export const getAgreementEncryptionMessage = async (
  signer: VoidSigner,
  agreement: Pick<Agreement, "owner" | "identifier" | "cid">
) => {
  const msg = await signer._signTypedData(domain, encryptionTypes, {
    "Owner Address": agreement.owner,
    "Agreement Identifier": agreement.identifier,
    CID: agreement.cid,
  });

  return Buffer.from(msg);
};
