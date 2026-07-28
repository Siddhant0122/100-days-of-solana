/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/proof_of_ship.json`.
 */
export type ProofOfShip = {
  "address": "9B2iYVYP1SLNi9tn6p5j6zAm8ggDK9w2eYHvHi7g2Qqw",
  "metadata": {
    "name": "proofOfShip",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "ship",
      "discriminator": [
        174,
        78,
        207,
        150,
        205,
        74,
        165,
        217
      ],
      "accounts": [
        {
          "name": "shipRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "builder"
              }
            ]
          }
        },
        {
          "name": "builder",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "projectName",
          "type": "string"
        },
        {
          "name": "message",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "shipRecord",
      "discriminator": [
        150,
        255,
        206,
        78,
        66,
        75,
        55,
        238
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Project name must be 64 characters or fewer"
    },
    {
      "code": 6001,
      "name": "messageTooLong",
      "msg": "Message must be 256 characters or fewer"
    }
  ],
  "types": [
    {
      "name": "shipRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "builder",
            "type": "pubkey"
          },
          {
            "name": "projectName",
            "type": "string"
          },
          {
            "name": "message",
            "type": "string"
          },
          {
            "name": "shippedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
