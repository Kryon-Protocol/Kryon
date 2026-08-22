/**
 * Per-network configuration registry.
 *
 * WHY THIS EXISTS
 * ---------------
 * Kryon used to resolve its network once, at *build* time, from
 * `NEXT_PUBLIC_STELLAR_NETWORK`. One bundle could therefore only ever talk to
 * one network, and offering testnet meant a second deployment.
 *
 * The navbar toggle needs both networks available inside a single bundle, so
 * every address for both is baked in below. All of these values are public
 * (contract ids, RPC endpoints, network passphrases) — nothing secret is
 * widened by shipping them to the browser.
 *
 * ── The env-inlining trap (do not "clean this up") ───────────────────────────
 * Every `process.env.NEXT_PUBLIC_X` read MUST be written as a literal member
 * expression. Next.js inlines these into the client bundle by *static textual
 * substitution*; a computed key (`process.env[key]`) is not substituted and
 * silently becomes `undefined` in the browser. This cost a day on 2026-07-08,
 * when the compiled chunk still contained the testnet vault address after
 * every Vercel env var had been independently verified correct — the culprit
 * was an `envOrDefault(key, fallback)` helper doing exactly that.
 *
 * ── How env overrides interact with the toggle ───────────────────────────────
 * `NEXT_PUBLIC_STELLAR_NETWORK` still names the deployment's PRIMARY network,
 * and the `NEXT_PUBLIC_*` overrides below still apply to it — so an existing
 * mainnet deployment behaves exactly as it did, fail-fast assertions included.
 * The other network falls back to its baked defaults. This keeps the operator's
 * ability to repoint a deployment at freshly redeployed contracts without a
 * code change, while making the second network available for free.
 */

export const NETWORK_IDS = ["mainnet", "testnet"] as const;
export type NetworkId = (typeof NETWORK_IDS)[number];

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === "string" && (NETWORK_IDS as readonly string[]).includes(value);
}

/** The deployment's primary network — the one `NEXT_PUBLIC_*` overrides target. */
export const PRIMARY_NETWORK: NetworkId = isNetworkId(process.env.NEXT_PUBLIC_STELLAR_NETWORK)
  ? process.env.NEXT_PUBLIC_STELLAR_NETWORK
  : "testnet";

export interface ContractSet {
  governance: string;
  oracleAdapter: string;
  vault: string;
  engine: string;
  orderGateway: string;
  insurance: string;
  liquidation: string;
  risk: string;
}

export interface AssetSet {
  nativeXlm: string;
  usdc: string;
  usdcIssuer: string;
}

export interface NetworkConfig {
  id: NetworkId;
  /** Human label for chrome: "Stellar Mainnet". */
  label: string;
  /** Short label for the navbar toggle: "Mainnet". */
  shortLabel: string;
  rpcUrl: string;
  passphrase: string;
  horizonUrl: string;
  explorerUrl: string;
  contracts: ContractSet;
  assets: AssetSet;
  /**
   * Whether this network is expected to have keepers (oracle/matcher/indexer)
   * running behind it. When false the UI shows a degraded-venue banner rather
   * than presenting an empty order book as if it were real market state.
   */
  keepersExpected: boolean;
}

// ─── Baked defaults ──────────────────────────────────────────────────────────
// Mainnet: deployed 2026-07-07, kryon-protocol/infra/deploy/mainnet-deployment.json
// Testnet: redeployed 2026-07-05, kryon-protocol/infra/deploy/testnet-deployment.toml

const MAINNET_DEFAULTS = {
  rpcUrl: "https://mainnet.sorobanrpc.com",
  passphrase: "Public Global Stellar Network ; September 2015",
  horizonUrl: "https://horizon.stellar.org",
  contracts: {
    governance: "CDSIEH7UZ62BT523G3RGJQGJHE7AI4EV265ESKZB672GTIEZNBYPYDXU",
    oracleAdapter: "CD3ZFYZPLJ6W2KO6HD7HE5P5Q27M5N6ITUPHQDRP23NBIVKE6WTUY25F",
    vault: "CDXGTJQS3XLGXSWDUHKMS5PBBFRRKRXRWH3HTBFNXBIAYEZNDTDKLR4J",
    engine: "CD6OMHCRDDBDO7I57HCUU52RORFPP7DUIRULWFBOX5WLCO5H2OB3W6LZ",
    orderGateway: "CBA2PSRHSIFTSUAFZWMF6CARNO7YR52PWLWLEXYVRACORS2RXNO2DUTJ",
    insurance: "CCBEJ3F2PUV5OA4JNX3CPSOJFQMYMFDPLNANR2GJZVQEEBFMB6JYNL54",
    liquidation: "CBGSXCZTZOSBMM5RLGZWWLE2USNAXL5ZKCHTZQ6DOKBD3PIEUJXFYDRO",
    risk: "CBHZWEIKXULFIH6DCSS7W6BJ3YUVQ5TJFYPP4UKQC4NKLNAF7VLPNVUI",
  },
  assets: {
    nativeXlm: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    usdc: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
} as const;

const TESTNET_DEFAULTS = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  contracts: {
    governance: "CBZT5HUXI42TD55GGB5Y7OZZ72IT5SN64ONOGDYS2PFQCOWIT4XOA6MU",
    oracleAdapter: "CARSV4BT3II5QONUAOP4D363OUNTTSSZCXSKNNXKZCBJM7Z6UXSNZ3LP",
    vault: "CBQ6634Z3UPXFVVHHV2JNSGXHQOZZK62Z65HCAQTINBGXS3IDXKRTRYK",
    engine: "CBSUYAO2EYAQVFISJQKG4TNMJPCDCPPFGI25Q3SW2BJPFSKQ45GRGTXN",
    orderGateway: "CAJGC2SIV6DFJETJ6ATG5MR6RPNX5HQ26LYA4RGSHF2QPTBS6OJWONL3",
    insurance: "CA3VD55APWCYLVN7PYGJ7NPKSQBE3VU4MWVCSKLOYAZI5RFWWR76G2CL",
    liquidation: "CDCRNKXTTTOO7IRVC66KZR5QMVGGZIOF2QPJSVELLD7G7F4IVLM2DCMG",
    risk: "CAVCW7XCQRA6VYWBKFDABYZGDNUJYHEYKHR4TT6BQBHS6QPDGFJVYBDS",
  },
  assets: {
    nativeXlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    usdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
} as const;

// ─── Env overrides (primary network only) ────────────────────────────────────
// Read once, as literal expressions, so Next.js inlines them. `pick` applies an
// override only when THIS network is the primary one.

const OVERRIDES = {
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  passphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE,
  horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
  governance: process.env.NEXT_PUBLIC_CONTRACT_GOVERNANCE,
  oracleAdapter: process.env.NEXT_PUBLIC_CONTRACT_ORACLE_ADAPTER,
  vault: process.env.NEXT_PUBLIC_CONTRACT_VAULT,
  engine: process.env.NEXT_PUBLIC_CONTRACT_ENGINE,
  orderGateway: process.env.NEXT_PUBLIC_CONTRACT_ORDER_GATEWAY,
  insurance: process.env.NEXT_PUBLIC_CONTRACT_INSURANCE,
  liquidation: process.env.NEXT_PUBLIC_CONTRACT_LIQUIDATION,
  risk: process.env.NEXT_PUBLIC_CONTRACT_RISK,
  nativeXlm: process.env.NEXT_PUBLIC_ASSET_NATIVE_XLM,
  usdc: process.env.NEXT_PUBLIC_ASSET_USDC,
  usdcIssuer: process.env.NEXT_PUBLIC_USDC_ISSUER,
} as const;

/**
 * Mainnet must never silently fall back to a baked address when it is the
 * primary (deployed) network — a wrong vault id there loses real funds. This
 * reproduces the original fail-fast contract exactly.
 */
function assertPresentOnPrimaryMainnet(key: string, value: string | undefined): void {
  if (PRIMARY_NETWORK === "mainnet" && !value) {
    throw new Error(`Missing ${key} for mainnet deployment`);
  }
}

for (const [key, value] of Object.entries(OVERRIDES)) {
  assertPresentOnPrimaryMainnet(key, value);
}

function buildNetwork(
  id: NetworkId,
  defaults: typeof MAINNET_DEFAULTS | typeof TESTNET_DEFAULTS
): NetworkConfig {
  // Overrides target the deployment's primary network only; the secondary
  // network always uses its baked defaults.
  const primary = id === PRIMARY_NETWORK;
  const pick = (override: string | undefined, fallback: string): string =>
    primary && override ? override : fallback;

  const isMainnet = id === "mainnet";
  return {
    id,
    label: isMainnet ? "Stellar Mainnet" : "Stellar Testnet",
    shortLabel: isMainnet ? "Mainnet" : "Testnet",
    rpcUrl: pick(OVERRIDES.rpcUrl, defaults.rpcUrl),
    passphrase: pick(OVERRIDES.passphrase, defaults.passphrase),
    horizonUrl: pick(OVERRIDES.horizonUrl, defaults.horizonUrl),
    explorerUrl: isMainnet
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet",
    contracts: {
      governance: pick(OVERRIDES.governance, defaults.contracts.governance),
      oracleAdapter: pick(OVERRIDES.oracleAdapter, defaults.contracts.oracleAdapter),
      vault: pick(OVERRIDES.vault, defaults.contracts.vault),
      engine: pick(OVERRIDES.engine, defaults.contracts.engine),
      orderGateway: pick(OVERRIDES.orderGateway, defaults.contracts.orderGateway),
      insurance: pick(OVERRIDES.insurance, defaults.contracts.insurance),
      liquidation: pick(OVERRIDES.liquidation, defaults.contracts.liquidation),
      risk: pick(OVERRIDES.risk, defaults.contracts.risk),
    },
    assets: {
      nativeXlm: pick(OVERRIDES.nativeXlm, defaults.assets.nativeXlm),
      usdc: pick(OVERRIDES.usdc, defaults.assets.usdc),
      usdcIssuer: pick(OVERRIDES.usdcIssuer, defaults.assets.usdcIssuer),
    },
    // Keepers are wired per network by the operator. `NEXT_PUBLIC_KEEPERS_*`
    // lets a deployment declare which venues are actually live; unset means
    // "only the primary network is live", which is the safe reading.
    keepersExpected: isMainnet
      ? parseKeepersFlag(process.env.NEXT_PUBLIC_MAINNET_KEEPERS_LIVE, id === PRIMARY_NETWORK)
      : parseKeepersFlag(process.env.NEXT_PUBLIC_TESTNET_KEEPERS_LIVE, id === PRIMARY_NETWORK),
  };
}

function parseKeepersFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: buildNetwork("mainnet", MAINNET_DEFAULTS),
  testnet: buildNetwork("testnet", TESTNET_DEFAULTS),
};

export function getNetworkConfig(id: NetworkId): NetworkConfig {
  return NETWORKS[id];
}
