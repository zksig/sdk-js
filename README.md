# ZKsig JavaScript SDK

[Documentation](https://sdk.zksig.io)

Library for interacting with the ZKsig digital signature contract in the following ways:

- Create agreements
- Sign agreements
- Get a list of agreements by address
- Get an agreement by address and index
- Get a list of signatures by address
- Get a signature by address and index

## Contract

Interacting with the ZKsig smart contract depends on [ethers](https://docs.ethers.org/).

- Read methods require an [Ethers Provider](https://docs.ethers.org/v5/single-page/#/v5/api/providers/).
- Write methods require an [Ethers Signer](https://docs.ethers.org/v5/single-page/#/v5/api/signer/)

```typescript
// Get a list of agreements for 0xa96bb1719fa7f78b8B2d3c24BBc79e52Ae9a3988
// This example uses a JsonRpcProvider
const provider = new providers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com	",
  {
    name: "Polygon Mumbai",
    chainId: 80001,
  }
);
const agreements = await getAgreements({
  provider,
  address: "0xa96bb1719fa7f78b8B2d3c24BBc79e52Ae9a3988",
  page: 1,
  perPage: 10,
});
```

```typescript
// Get a user's profile
// This example uses a Web3Provider
const provider = new providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const agreements = await getProfile({
  signer,
});
```

## PDF Agreements with ZKsigAgreement

The `ZKsigAgreement` class helps interact with a PDF agreement in the
following ways:

- Add signature fields to a PDF
- Add the agreement to the blockchain

```typescript
const agreement = new ZKsigAgreement();
await agreement.init(pdfBytes);
await agreement.addSignatureField({
  page: 1, // page on which the signature should be
  x: 10, // x coordinate on the PDF where the signature should start
  y: 10, // y coordinate on the PDF where the signature should start
  identifier: "employee", // signature field name used to group multiple fields with the same signer
});
await agreement.createOnChain(signer);
```
