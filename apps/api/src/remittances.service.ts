import { BadRequestException, Injectable } from '@nestjs/common';
import { AppendOnlyLedger, canonicalizeEntryPayload, type LedgerSignature, type LedgerValidator } from '@qzd/ledger';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { QuoteResponse, Transaction, USRemitAcquireQZDRequest } from '@qzd/sdk-api/server';

const USD_MINOR_UNIT_SCALE = 100;
const DEFAULT_FEE_MINOR_UNITS = 99; // $0.99
const BASIS_POINT_SCALE = 10_000;
const TARIFFED_FEE_BASIS_POINTS = 300; // 3%
const FX_RATE_NUMERATOR = 39; // 7.8 expressed as 39/5
const FX_RATE_DENOMINATOR = 5;
const RATE_SCALE = 10_000; // rate precision of four decimals
const QUOTE_EXPIRY_MINUTES = 5;
const ASSET_CODE = 'QZD';
const ISSUANCE_THRESHOLD = 2;

const VALIDATOR_KEYS = [
  { id: 'validator-1', privateKey: '4b8c5bd2b1c78e51a384643b4c8973d5ac25e83e5a69e9e9240a0f3a3e981f01' },
  { id: 'validator-2', privateKey: '7f1ceab9da39979f68fb82ca5c22c02995ee50f74f072fe97c1a1c9bf9efcc02' },
  { id: 'validator-3', privateKey: '5a6f06ed4af3ad7f26d2a7f85407a820b2ce52402ac2c2a3841216295dac8603' },
] as const;

export type QuoteScenario = 'DEFAULT' | 'TARIFFED' | 'SUBSIDIZED';

interface LedgerAccountRef {
  accountId: string;
  ledgerId: string;
}

type Clock = () => Date;

@Injectable()
export class RemittancesService {
  private readonly ledger: AppendOnlyLedger;
  private readonly validators: LedgerValidator[];
  private readonly keyMap = new Map<string, string>();
  private readonly accounts = new Map<string, LedgerAccountRef>();
  private sequence = 0;
  private quoteSequence = 0;

  constructor(private readonly clock: Clock = () => new Date()) {
    this.validators = VALIDATOR_KEYS.map(({ id, privateKey }) => {
      const publicKey = bytesToHex(secp256k1.getPublicKey(hexToBytes(privateKey), true));
      this.keyMap.set(id, privateKey);
      return { id, publicKey } satisfies LedgerValidator;
    });

    this.ledger = new AppendOnlyLedger({
      issuanceValidators: this.validators,
      issuanceThreshold: ISSUANCE_THRESHOLD,
    });
  }

  simulateQuote(usdAmount: string, scenario: string | QuoteScenario = 'DEFAULT'): QuoteResponse {
    const normalizedScenario = this.normalizeScenario(scenario);
    const amountMinorUnits = this.parseUsdMinorUnits(usdAmount);
    const { quote } = this.createQuote(amountMinorUnits, normalizedScenario);

    return quote;
  }

  acquireQzd(request: USRemitAcquireQZDRequest): Transaction {
    const scenario = this.normalizeScenario(request.scenario ?? 'DEFAULT');
    const amountMinorUnits = this.parseUsdMinorUnits(request.usdAmount.value);
    const { quote, buyMinorUnits } = this.createQuote(amountMinorUnits, scenario);

    const minorUnits = buyMinorUnits;
    if (minorUnits <= 0) {
      throw new BadRequestException('Requested amount does not produce any QZD.');
    }

    const beneficiary = this.resolveBeneficiaryAccount(request);
    const entryInput = {
      type: 'ISSUE' as const,
      amount: minorUnits,
      asset: ASSET_CODE,
      to_account: beneficiary.ledgerId,
      meta: {
        quoteId: quote.quoteId,
        scenario,
        senderPhone: request.senderPhone,
        receiverPhone: request.receiverPhone ?? null,
        usdAmount: request.usdAmount.value,
      },
    };

    const canonical = canonicalizeEntryPayload(entryInput);
    const sigs = this.createSignatures(canonical);
    const ledgerEntry = this.ledger.postEntry({ ...entryInput, sigs });

    this.sequence += 1;
    const createdAt = this.clock().toISOString();

    return {
      id: `txn_issuance_${this.sequence.toString().padStart(6, '0')}`,
      accountId: beneficiary.accountId,
      type: 'issuance',
      amount: quote.buyAmount,
      status: 'posted',
      createdAt,
      metadata: {
        ledgerEntryId: String(ledgerEntry.id),
        quoteId: quote.quoteId,
        scenario,
      },
    } satisfies Transaction;
  }

  getLedgerHistory() {
    return this.ledger.getHistory();
  }

  protected createSignatures(canonical: string): LedgerSignature[] {
    const digest = sha256(new TextEncoder().encode(canonical));
    const signatures: LedgerSignature[] = [];

    for (const validator of this.validators.slice(0, ISSUANCE_THRESHOLD)) {
      const privateKey = this.keyMap.get(validator.id);
      if (!privateKey) {
        continue;
      }
      const signature = bytesToHex(secp256k1.sign(digest, hexToBytes(privateKey)).toCompactRawBytes());
      signatures.push({ validatorId: validator.id, signature });
    }

    return signatures;
  }

  private resolveBeneficiaryAccount(request: USRemitAcquireQZDRequest): LedgerAccountRef {
    const accountId = request.receiverAccountId ?? (request.receiverPhone ? `wallet:${request.receiverPhone}` : undefined);
    if (!accountId) {
      throw new BadRequestException('receiverAccountId or receiverPhone is required');
    }

    const cached = this.accounts.get(accountId);
    if (cached) {
      return cached;
    }

    const alias = `beneficiary:${accountId}`;
    const ledgerAccount = this.ledger.openAccount({
      alias,
      kyc_level: 'FULL',
      public_key: `pub:${alias}`,
    });

    const ref: LedgerAccountRef = { accountId, ledgerId: ledgerAccount.id };
    this.accounts.set(accountId, ref);
    return ref;
  }

  private normalizeScenario(raw: string | QuoteScenario): QuoteScenario {
    const normalized = typeof raw === 'string' ? raw.toUpperCase() : raw;
    if (normalized === 'TARIFFED' || normalized === 'SUBSIDIZED') {
      return normalized;
    }
    return 'DEFAULT';
  }

  private parseUsdMinorUnits(raw: string): number {
    const normalized = raw?.trim();
    if (!normalized) {
      throw new BadRequestException('usdAmount must be a positive decimal string');
    }

    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      throw new BadRequestException('usdAmount must be a positive decimal string');
    }

    const [wholePart, fractionalPart = ''] = normalized.split('.');
    const digits = BigInt(`${wholePart}${fractionalPart}`);
    const scale = BigInt(10) ** BigInt(fractionalPart.length);
    const numerator = digits * BigInt(USD_MINOR_UNIT_SCALE);
    const denominator = scale;
    const cents = Number((numerator * 2n + denominator) / (denominator * 2n));

    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new BadRequestException('usdAmount must be a positive decimal string');
    }

    return cents;
  }

  private calculateFeeMinorUnits(amountMinorUnits: number, scenario: QuoteScenario): number {
    switch (scenario) {
      case 'TARIFFED': {
        const numerator = BigInt(amountMinorUnits) * BigInt(TARIFFED_FEE_BASIS_POINTS);
        const denominator = BigInt(BASIS_POINT_SCALE);
        return Number((numerator * 2n + denominator) / (denominator * 2n));
      }
      case 'SUBSIDIZED':
        return 0;
      case 'DEFAULT':
      default:
        return Math.min(amountMinorUnits, DEFAULT_FEE_MINOR_UNITS);
    }
  }

  private calculateBuyMinorUnits(netUsdMinorUnits: number): number {
    if (netUsdMinorUnits <= 0) {
      return 0;
    }

    const numerator = BigInt(netUsdMinorUnits) * BigInt(FX_RATE_NUMERATOR);
    const denominator = BigInt(FX_RATE_DENOMINATOR);
    return Number((numerator * 2n + denominator) / (denominator * 2n));
  }

  private formatMinorUnits(value: number): string {
    const absolute = Math.abs(value);
    const major = Math.floor(absolute / USD_MINOR_UNIT_SCALE);
    const minor = (absolute % USD_MINOR_UNIT_SCALE).toString().padStart(2, '0');
    const sign = value < 0 ? '-' : '';
    return `${sign}${major}.${minor}`;
  }

  private formatRate(buyMinorUnits: number, sellMinorUnits: number): string {
    if (sellMinorUnits === 0) {
      return '0.0000';
    }

    const numerator = BigInt(buyMinorUnits) * BigInt(RATE_SCALE);
    const denominator = BigInt(sellMinorUnits);
    const scaled = (numerator * 2n + denominator) / (denominator * 2n);
    const whole = scaled / BigInt(RATE_SCALE);
    const fractional = (scaled % BigInt(RATE_SCALE)).toString().padStart(4, '0');
    return `${whole.toString()}.${fractional}`;
  }

  private buildQuoteId(scenario: QuoteScenario): string {
    this.quoteSequence += 1;
    return `quote_${scenario.toLowerCase()}_${this.quoteSequence.toString().padStart(6, '0')}`;
  }

  private createQuote(amountMinorUnits: number, scenario: QuoteScenario): {
    quote: QuoteResponse;
    buyMinorUnits: number;
  } {
    const feeMinorUnits = this.calculateFeeMinorUnits(amountMinorUnits, scenario);
    const netMinorUnits = Math.max(0, amountMinorUnits - feeMinorUnits);
    const buyMinorUnits = this.calculateBuyMinorUnits(netMinorUnits);
    const rate = this.formatRate(buyMinorUnits, amountMinorUnits);
    const quoteId = this.buildQuoteId(scenario);
    const expiresAt = new Date(this.clock().getTime() + QUOTE_EXPIRY_MINUTES * 60_000).toISOString();

    return {
      quote: {
        quoteId,
        sellAmount: { currency: 'USD', value: this.formatMinorUnits(amountMinorUnits) },
        buyAmount: { currency: ASSET_CODE, value: this.formatMinorUnits(buyMinorUnits) },
        rate,
        expiresAt,
      },
      buyMinorUnits,
    };
  }
}

