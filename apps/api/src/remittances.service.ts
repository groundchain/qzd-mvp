import { BadRequestException, Injectable } from '@nestjs/common';
import { AppendOnlyLedger, canonicalizeEntryPayload, type LedgerSignature, type LedgerValidator } from '@qzd/ledger';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { QuoteResponse, Transaction, USRemitAcquireQZDRequest } from '@qzd/sdk-api/server';

const FX_RATE = 7.8;
const DEFAULT_FEE = 0.99;
const TARIFFED_FEE_RATE = 0.03;
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
  private readonly rng =
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto
      : undefined;
  private sequence = 0;

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
    const amount = this.parseAmount(usdAmount);
    const fee = this.calculateFee(amount, normalizedScenario);
    const netUsd = Math.max(0, amount - fee);
    const buyValue = this.roundToTwoDecimals(netUsd * FX_RATE);
    const buyFormatted = this.formatAmount(buyValue);
    const quoteId = this.buildQuoteId(normalizedScenario);
    const expiresAt = new Date(this.clock().getTime() + QUOTE_EXPIRY_MINUTES * 60_000).toISOString();

    return {
      quoteId,
      sellAmount: { currency: 'USD', value: this.formatAmount(amount) },
      buyAmount: { currency: ASSET_CODE, value: buyFormatted },
      rate: this.formatRate(buyValue, amount),
      expiresAt,
    } satisfies QuoteResponse;
  }

  acquireQzd(request: USRemitAcquireQZDRequest): Transaction {
    const scenario = this.normalizeScenario(request.scenario ?? 'DEFAULT');
    const quote = this.simulateQuote(request.usdAmount.value, scenario);

    const minorUnits = Math.round(Number.parseFloat(quote.buyAmount.value) * 100);
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

  private calculateFee(amount: number, scenario: QuoteScenario): number {
    switch (scenario) {
      case 'TARIFFED':
        return this.roundToTwoDecimals(amount * TARIFFED_FEE_RATE);
      case 'SUBSIDIZED':
        return 0;
      case 'DEFAULT':
      default:
        return DEFAULT_FEE;
    }
  }

  private normalizeScenario(raw: string | QuoteScenario): QuoteScenario {
    const normalized = typeof raw === 'string' ? raw.toUpperCase() : raw;
    if (normalized === 'TARIFFED' || normalized === 'SUBSIDIZED') {
      return normalized;
    }
    return 'DEFAULT';
  }

  private parseAmount(raw: string): number {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('usdAmount must be a positive decimal string');
    }
    return parsed;
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatAmount(value: number): string {
    return value.toFixed(2);
  }

  private formatRate(buyValue: number, usdAmount: number): string {
    if (usdAmount === 0) {
      return '0.0000';
    }
    return (buyValue / usdAmount).toFixed(4);
  }

  private buildQuoteId(scenario: QuoteScenario): string {
    const suffix = this.rng && typeof this.rng.randomUUID === 'function'
      ? this.rng.randomUUID()
      : Math.random().toString(36).slice(2, 10);
    return `quote_${scenario.toLowerCase()}_${suffix}`;
  }
}

