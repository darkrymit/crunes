# File Vault

Encrypt files into a local vault, list what's stored, and decrypt them back.

## What it demonstrates

Uses `crypto.encrypt`/`decrypt` (AES-256-CBC) with `fs.readAsBytes`/`writeAsBytes` for binary file I/O, `codec.fromUtf8` for key derivation, and `fs.glob`/`fs.stat` to list vault contents.

> **Note:** Key and IV derivation here is demo-only (password padded to 32 bytes, fixed IV). Do not use this approach in production.

## How to run

```bash
crunes run encrypt --file secrets.txt --password mypassword
crunes run list
crunes run decrypt --file secrets.txt --password mypassword
```

- `encrypt --file <path> --password <text>` — encrypts a file into the vault
- `list` — shows all encrypted files in the vault
- `decrypt --file <basename> --password <text>` — recovers a file to `decrypted/`

## What to expect

After encrypt, the file is stored in `vault/secrets.txt.enc` (gitignored). After decrypt, `decrypted/secrets.txt` matches the original `secrets.txt`.
