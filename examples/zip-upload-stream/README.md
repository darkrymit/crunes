# Secure Streaming Archive & Codec Upload Demo

A high-performance demonstration of **crunes** advanced WHATWG Web Streams integration. It showcases zipping, encrypting, encoding, and streaming directories directly to disk and HTTP POST without intermediate file writes.

## What it demonstrates

This example utilizes advanced streaming compositions:

1.  **On-the-fly Zip Packing (`archive.zipStream`)**: Reads a local folder of files and packs them into a compressed `ReadableStream<Uint8Array>` on-the-fly.
2.  **Streaming Symmetric Encryption (`crypto.encryptStream`)**: Encrypts the compressed zip stream on-the-fly using `aes-256-gcm` symmetric encryption.
3.  **Streaming Base64 Encoding (`codec.base64EncoderStream`)**: Receives the encrypted binary stream and encodes it chunk-by-chunk into Base64 string chunks.
4.  **Standard HTTP Stream Upload (`fetch`)**: Streams the encrypted and base64-encoded zip payload directly over the internet via an HTTP POST request to `https://httpbin.org/post` with zero intermediate storage or V8 memory buffering.
5.  **Streaming Base64 Decoding, Decryption & Unpacking (`archive.unzipStream`)**: Streams the Base64 payload from disk, decodes it, decrypts it on-the-fly via `crypto.decryptStream`, and extracts the folders directly back to disk.

---

## Setup & Execution

### 1. Pack, Encrypt and Upload the Stream
Zips the target directory, encrypts it, encodes it, saves the key material (`secret.json`) and base64 payload to disk, and streams the upload to `httpbin.org`:
```bash
crunes use pack-and-upload
```

### 2. Download, Decrypt and Unpack the Stream
Reads the keys and payload stream from disk, decodes and decrypts it chunk-by-chunk, and extracts files directly:
```bash
crunes use download-and-unpack
```

---

## Technical Composition

The core pipeline showcases standard WHATWG streaming pipe operations inside the sandboxed V8 execution context:

#### Pack Pipeline:
```javascript
archive.zipStream('source_folder/')
  .pipeThrough(crypto.encryptStream('aes-256-gcm', key, iv))
  .pipeThrough(codec.base64EncoderStream())
  .pipeThrough(new TextEncoderStream())
  .pipeTo(fs.writeStreamAsBytes('packed_payload.b64'))
```

#### Unpack Pipeline:
```javascript
fs.readStream('packed_payload.b64')
  .pipeThrough(codec.base64DecoderStream())
  .pipeThrough(crypto.decryptStream('aes-256-gcm', key, iv))
  .pipeTo(archive.unzipStream('extracted_folder/'))
```

