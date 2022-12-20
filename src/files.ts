import nacl from "tweetnacl";
import { packToBlob } from "ipfs-car/pack/blob";
import { MemoryBlockStore } from "ipfs-car/blockstore/memory";

export const downloadAndDecrypt = async ({
  cid,
  encryptionPWBytes,
}: {
  cid: string;
  encryptionPWBytes: Uint8Array;
}) => {
  const res = await fetch(`https://w3s.link/ipfs/${cid}`);
  if (!res.ok) {
    throw new Error("Could not fetch agreement from IPFS");
  }

  const pdf = nacl.secretbox.open(
    new Uint8Array(await res.arrayBuffer()),
    new Uint8Array(24),
    encryptionPWBytes.slice(0, 32)
  );

  if (!pdf) throw new Error("Agreement decryption failed");

  return pdf;
};

export const pinFile = async ({
  file,
  name,
}: {
  file: Uint8Array;
  name: string;
}) => {
  const { root, car } = await packToBlob({
    input: file,
    blockstore: new MemoryBlockStore(),
    wrapWithDirectory: false,
  });

  const fd = new FormData();
  fd.append("file", car, name);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    throw new Error("Unable to pin file to IPFS");
  }

  return root.toV1().toString();
};

export const encryptAgreementAndPin = async ({
  pdf,
  name,
  encryptionPWBytes,
}: {
  pdf: Uint8Array;
  name: string;
  encryptionPWBytes: Uint8Array;
}): Promise<string> => {
  const encrypted = nacl.secretbox(
    pdf,
    new Uint8Array(24),
    encryptionPWBytes.slice(0, 32)
  );

  return pinFile({ file: encrypted, name });
};
