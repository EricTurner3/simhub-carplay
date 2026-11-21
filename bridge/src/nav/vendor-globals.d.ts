// truckermudgeon/maps' navigation server code (type-checked via the worker's
// imports) uses the WebCrypto `CryptoKey` global type, which @types/node only
// exposes under node:crypto.
type CryptoKey = import('node:crypto').webcrypto.CryptoKey;
