import { useCallback, useEffect, useState } from 'react'
import { MsgSend } from 'cosmes/client'
import {
  ConnectedWallet,
  CosmostationController,
  KeplrController,
  LeapController,
  StationController,
  UnsignedTx,
  WalletController,
  WalletName,
  WalletType
} from 'cosmes/wallet'
import { LiquidityModal } from '@leapwallet/elements'
import '@leapwallet/elements/styles.css'

const WC_PROJECT_ID = '2b7d5a2da89dd74fed821d184acabf95'
const SIGN_ARBITRARY_MSG =
  'Hi from Leap! This is a test message just to prove that the wallet is working.'
const TX_MEMO = 'signed via cosmes'

const CHAINS: Record<string, string> = {
  'osmosis-1': 'Osmosis',
  'juno-1': 'Juno',
  'kaiyo-1': 'Kujira',
  'phoenix-1': 'Terra',
  'columbus-5': 'Terra Classic',
  'neutron-1': 'Neutron'
}

const WALLETS: Record<WalletName, string> = {
  [WalletName.LEAP]: 'Leap',
  [WalletName.KEPLR]: 'Keplr',
  [WalletName.COSMOSTATION]: 'Cosmostation',
  [WalletName.STATION]: 'Terra Station'
}

const TYPES: Record<WalletType, string> = {
  [WalletType.EXTENSION]: 'Extension',
  [WalletType.WALLETCONNECT]: 'Wallet Connect'
}

const CONTROLLERS: Record<string, WalletController> = {
  [WalletName.LEAP]: new LeapController(WC_PROJECT_ID),
  [WalletName.KEPLR]: new KeplrController(WC_PROJECT_ID),
  [WalletName.COSMOSTATION]: new CosmostationController(WC_PROJECT_ID),
  [WalletName.STATION]: new StationController()
}

function getRpc(chain: string): string {
  switch (chain) {
    case 'osmosis-1':
      return 'https://rpc.osmosis.zone'
    case 'juno-1':
      return 'https://juno-rpc.polkachu.com'
    case 'kaiyo-1':
      return 'https://rpc.kaiyo.kujira.setten.io'
    case 'phoenix-1':
      return 'https://terra-rpc.publicnode.com'
    case 'columbus-5':
      return 'https://terra-classic-rpc.publicnode.com'
    case 'neutron-1':
      return 'https://neutron-rpc.polkachu.com'
    default:
      throw new Error('Unknown chain')
  }
}

function getGasPrice(chain: string): { amount: string; denom: string } {
  switch (chain) {
    case 'osmosis-1':
      return { amount: '0.0025', denom: getDenom(chain) }
    case 'juno-1':
      return { amount: '0.001', denom: getDenom(chain) }
    case 'kaiyo-1':
      return { amount: '0.00119', denom: getDenom(chain) }
    case 'phoenix-1':
      return { amount: '0.015', denom: getDenom(chain) }
    case 'columbus-5':
      return { amount: '28.325', denom: getDenom(chain) }
    case 'neutron-1':
      return { amount: '0.01', denom: getDenom(chain) }
    default:
      throw new Error('Unknown chain')
  }
}

function getDenom(chain: string): string {
  switch (chain) {
    case 'osmosis-1':
      return 'uosmo'
    case 'juno-1':
      return 'ujuno'
    case 'kaiyo-1':
      return 'ukuji'
    case 'phoenix-1':
    case 'columbus-5':
      return 'uluna'
    case 'neutron-1':
      return 'untrn'
    default:
      throw new Error('Unknown chain')
  }
}

const App = () => {
  const [chain, setChain] = useState<string>('osmosis-1')
  const [wallet, setWallet] = useState<WalletName>(WalletName.LEAP)
  const [wallets, setWallets] = useState<Record<string, ConnectedWallet>>({})
  const [type, setType] = useState<WalletType>(WalletType.EXTENSION)

  const connect = useCallback(
    async (type: WalletType, chainIds: string[]) => {
      try {
        const chainInfos = chainIds.map((chainId) => ({
          chainId,
          rpc: getRpc(chainId),
          gasPrice: getGasPrice(chainId)
        }))
        const res = await CONTROLLERS[wallet].connect(type, chainInfos)
        setWallets({ ...wallets, ...Object.fromEntries(res) })
      } catch (err) {
        console.error(err)
        alert((err as Error).message)
      }
    },
    [wallet, wallets]
  )

  const disconnect = useCallback(() => {
    CONTROLLERS[wallet].disconnect([chain])
  }, [wallet, chain])

  const signArbitrary = useCallback(async () => {
    const wallet = wallets[chain]
    if (!wallet) {
      alert('Wallet not connected yet')
      return
    }
    try {
      const res = await wallet.signArbitrary(SIGN_ARBITRARY_MSG)
      console.log(res)
      alert('Sign success! Check console logs for details.')
    } catch (err) {
      console.error(err)
      alert((err as Error).message)
    }
  }, [chain, wallets])

  console.log()

  const broadcastTx = useCallback(async () => {
    const wallet = wallets[chain]
    if (!wallet) {
      alert('Wallet not connected yet')
      return
    }
    try {
      const tx: UnsignedTx = {
        msgs: [
          new MsgSend({
            fromAddress: wallet.address,
            toAddress: wallet.address,
            amount: [
              {
                denom: getDenom(chain),
                amount: '1'
              }
            ]
          })
        ],
        memo: TX_MEMO
      }

      const fee = await wallet.estimateFee(tx)
      console.log('Tx fee:', fee)

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { txResponse } = await wallet.broadcastTx(tx, fee)
      console.log('Tx result:', txResponse)

      alert(
        'Broadcast success!\n\nTx hash: ' +
          txResponse.txhash +
          '\n\nCheck console logs for details.'
      )
    } catch (err) {
      console.error(err)
      alert((err as Error).message)
    }
  }, [chain, wallets])

  useEffect(() => {
    Object.values(CONTROLLERS).forEach((controller) => {
      // Register to disconnect event
      controller.onDisconnect((wallets) => {
        const chains = wallets.map((w) => w.chainId)
        console.log('Wallet disconnected', {
          wallet: controller.id,
          chains
        })
        for (const chain of chains) {
          setWallets((prevWallets) => {
            const newWallets = { ...prevWallets }
            delete newWallets[chain]
            return newWallets
          })
        }
      })

      // Register to account change event
      controller.onAccountChange((wallets) => {
        // Reconnect the affected wallets
        const chains = wallets.map((w) => w.chainId)
        console.log('Wallet account changed', {
          wallet: controller.id,
          chains
        })
        connect(wallets[0].type, chains)
      })
    })
  }, [connect])

  const currentWallet = wallets[chain]

  //export interface StdSignDoc {
  //     readonly chain_id: string;
  //     readonly account_number: string;
  //     readonly sequence: string;
  //     readonly fee: StdFee;
  //     readonly msgs: readonly AminoMsg[];
  //     readonly memo: string;
  // }
  // export type Algo = "secp256k1" | "ed25519" | "sr25519";
  // export interface AccountData {
  //     /** A printable address (typically bech32 encoded) */
  //     readonly address: string;
  //     readonly algo: Algo;
  //     readonly pubkey: Uint8Array;
  // }
  // export interface AminoSignResponse {
  //     /**
  //      * The sign doc that was signed.
  //      * This may be different from the input signDoc when the signer modifies it as part of the signing process.
  //      */
  //     readonly signed: StdSignDoc;
  //     readonly signature: StdSignature;
  // }
  // export interface OfflineAminoSigner {
  //     /**
  //      * Get AccountData array from wallet. Rejects if not enabled.
  //      */
  //     readonly getAccounts: () => Promise<readonly AccountData[]>;
  //     /**
  //      * Request signature from whichever key corresponds to provided bech32-encoded address. Rejects if not enabled.
  //      *
  //      * The signer implementation may offer the user the ability to override parts of the signDoc. It must
  //      * return the doc that was signed in the response.
  //      *
  //      * @param signerAddress The address of the account that should sign the transaction
  //      * @param signDoc The content that should be signed
  //      */
  //     readonly signAmino: (signerAddress: string, signDoc: StdSignDoc) => Promise<AminoSignResponse>;
  // }

  // const offlineAminoSigner = currentWallet
  //   ? {
  //       getAccounts: () => {
  //         const pubKey = currentWallet?.pubKey.toAmino()
  //         return Promise.resolve([
  //           {
  //             address: currentWallet.address,
  //             algo: pubKey.type.includes('ed25519')
  //               ? 'ed25519'
  //               : pubKey.type.includes('secp256k1')
  //               ? 'secp256k1'
  //               : pubKey.type.includes('sr25519')
  //               ? 'sr25519'
  //               : 'unknown',
  //             pubkey: pubKey.value.key
  //           }
  //         ])
  //       },
  //       signAmino: (
  //         signerAddress: string,
  //         signDoc: StdSignDoc
  //       ): Promise<AminoSignResponse> => {
  //         wallet.ex
  //         return Promise.resolve({
  //           signed: signDoc,
  //           signature: {
  //             pub_key: currentWallet.pubKey.toAmino(),
  //             signature: currentWallet.sign(signDoc)
  //           }
  //         })
  //       }
  //     }
  //   : undefined

  return (
    <main className="bg-gray-900 p-8 h-screen overflow-y-auto bg-fixed">
      <section className="text-gray-100 flex flex-col items-center justify-center text-sm sm:text-base md:text-lg space-y-3">
        <select
          className="bg-gray-700 rounded p-2 text-gray-200"
          value={chain}
          onChange={(e) => setChain(e.target.value)}
        >
          {Object.keys(CHAINS).map((id) => (
            <option value={id}>{CHAINS[id]}</option>
          ))}
        </select>
        <div className="flex space-x-2">
          <select
            className="bg-gray-700 rounded p-2 text-gray-200"
            value={wallet}
            onChange={(e) => setWallet(e.target.value as WalletName)}
          >
            {Object.keys(WALLETS).map((wallet) => (
              <option value={wallet}>{WALLETS[wallet as WalletName]}</option>
            ))}
          </select>
          <select
            className="bg-gray-700 rounded p-2 text-gray-200"
            value={type}
            onChange={(e) => setType(e.target.value as WalletType)}
          >
            {Object.keys(TYPES).map((type) => (
              <option value={type}>{TYPES[type as WalletType]}</option>
            ))}
          </select>
        </div>

        <div className="flex space-x-2">
          <button
            className="bg-red-700 hover:bg-red-600 text-red-100 p-2 rounded"
            onClick={disconnect}
          >
            Disconnect
          </button>
          <button
            className="bg-green-700 hover:bg-green-600 text-green-100 p-2 rounded"
            onClick={() => connect(type, [chain])}
          >
            Connect
          </button>
        </div>

        <button
          className="bg-blue-800 hover:bg-blue-700 text-blue-100 p-2 rounded"
          onClick={signArbitrary}
        >
          Sign Arbitrary
        </button>

        <button
          className="bg-blue-800 hover:bg-blue-700 text-blue-100 p-2 rounded"
          onClick={broadcastTx}
        >
          Broadcast Tx
        </button>

        <div className="flex flex-col">
          <code>CONNECTED WALLETS</code>
          {Object.values(wallets).map((wallet) => (
            <code>
              {wallet.address.slice(0, 10)}
              ...{wallet.address.slice(-5)} | {WALLETS[wallet.id]}
            </code>
          ))}
        </div>
      </section>
      <LiquidityModal
        config={{
          icon: '/vite.svg',
          title: 'Try out Liquidity Modal',
          subtitle: 'With CosmES'
        }}
        walletClientConfig={{
          userAddress: currentWallet.address,
          walletClient: {
            enable: (chainIds: string | string[]): Promise<void> => {
              return connect(
                type,
                Array.isArray(chainIds) ? chainIds : [chainIds]
              )
            },
            getKey: (chainId: string) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              return currentWallet.ext.getKey(chainId)
            },
            getOfflineSigner: (chainId: string) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              return currentWallet.ext.getOfflineSigner(chainId)
            }
          },
          connectWallet: () => connect(type, [chain])
        }}
        theme={'light'}
        renderLiquidityButton={({ onClick }) => {
          return (
            <button
              className="bg-blue-800 hover:bg-blue-700 text-blue-100 p-2 rounded"
              onClick={onClick}
            >
              Open Liquidity Modal
            </button>
          )
        }}
      />
    </main>
  )
}

export default App
