import AdmZip from 'adm-zip';
import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { AppError, ErrorCode, add, toMoney, toRate } from '@carinet/shared';

/**
 * §9 — e-Fatura/e-Arsiv mukellefi cogunluk: entegrator portalindan UBL-TR XML/ZIP.
 * Cari eslesmesi VKN ile yapilir (altin kaynak). Ciktisi Zod'dan gecmeden KULLANILMAZ (kural #7).
 */
@Injectable()
export class UblParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    removeNSPrefix: true, // cbc:/cac: onekleri sadelesir
    parseTagValue: false, // sayilar STRING kalir — float'a dusmesin (kural #1)
    parseAttributeValue: false,
    trimValues: true,
  });

  /** ZIP ise iceriden tum .xml dosyalari, degilse tek XML. */
  extractXmlFiles(buffer: Buffer, fileName: string): { name: string; xml: string }[] {
    if (!fileName.toLowerCase().endsWith('.zip')) {
      return [{ name: fileName, xml: buffer.toString('utf8') }];
    }

    const entries = new AdmZip(buffer)
      .getEntries()
      .filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith('.xml'));

    if (entries.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'ZIP icinde XML fatura bulunamadi');
    }
    return entries.map((e) => ({ name: e.entryName, xml: e.getData().toString('utf8') }));
  }

  /** Tek UBL faturasini kanonik nesneye cevirir. Dogrulama cagirana aittir (ublInvoiceSchema). */
  parseInvoice(xml: string): Record<string, unknown> {
    const doc = this.parser.parse(xml) as Record<string, unknown>;
    const invoice = pick(doc, 'Invoice');
    if (!invoice) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Gecerli bir UBL fatura belgesi degil');
    }

    const lines = asArray(invoice.InvoiceLine).map((line) => {
      const item = pick(line, 'Item') ?? {};
      const price = pick(line, 'Price') ?? {};
      const lineTax = pick(line, 'TaxTotal') ?? {};
      const subtotal = asArray(pick(lineTax, 'TaxSubtotal'))[0] ?? {};

      const netTotal = text(line.LineExtensionAmount) ?? '0';
      const taxAmount = text(lineTax.TaxAmount) ?? '0';

      return {
        name: text(item.Name) ?? 'Kalem',
        unit: attr(line.InvoicedQuantity, '@unitCode') ?? 'ADET',
        quantity: toRate(text(line.InvoicedQuantity) ?? '0'),
        unitPrice: toMoney(text(price.PriceAmount) ?? '0'),
        taxRate: text(subtotal.Percent) ?? '0',
        netTotal: toMoney(netTotal),
        taxAmount: toMoney(taxAmount),
        lineTotal: toMoney(sumStrings(netTotal, taxAmount)),
      };
    });

    const totals = pick(invoice, 'LegalMonetaryTotal') ?? {};
    const taxTotal = asArray(pick(invoice, 'TaxTotal'))[0] ?? {};
    const customer = pick(pick(invoice, 'AccountingCustomerParty') ?? {}, 'Party') ?? {};
    const paymentTerms = asArray(pick(invoice, 'PaymentTerms'))[0] ?? {};
    const pricingRate = asArray(pick(invoice, 'PricingExchangeRate'))[0] ?? {};

    return {
      ublUuid: text(invoice.UUID),
      invoiceNo: text(invoice.ID),
      invoiceDate: text(invoice.IssueDate),
      dueDate: text(paymentTerms.PaymentDueDate) ?? text(invoice.DueDate),
      currencyCode: text(invoice.DocumentCurrencyCode) ?? 'TRY',
      exchangeRate: text(pricingRate.CalculationRate) ?? '1',
      buyerVkn: partyIdentifier(customer),
      buyerName: text(pick(pick(customer, 'PartyName') ?? {}, 'Name')),
      netTotal: text(totals.LineExtensionAmount) ?? '0',
      taxTotal: text(taxTotal.TaxAmount) ?? '0',
      grandTotal: text(totals.PayableAmount) ?? '0',
      items: lines,
    };
  }
}

/** UBL-TR'de VKN/TCKN, PartyIdentification altinda schemeID ile gelir. */
function partyIdentifier(party: Record<string, unknown>): string | undefined {
  for (const id of asArray(pick(party, 'PartyIdentification'))) {
    const scheme = attr(id.ID, '@schemeID')?.toUpperCase();
    const value = text(id.ID);
    if (value && (scheme === 'VKN' || scheme === 'TCKN' || scheme === undefined)) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------- XML gezinme yardimcilari

type Node = Record<string, unknown>;

const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(node: unknown, key: string): Node | undefined {
  if (!isNode(node)) return undefined;
  const value = node[key];
  if (Array.isArray(value)) return isNode(value[0]) ? value[0] : undefined;
  return isNode(value) ? value : undefined;
}

function asArray(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

/** Deger ya duz metindir ya da { '#text': ..., '@attr': ... } nesnesidir. */
function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  if (isNode(value) && '#text' in value) return String(value['#text']).trim() || undefined;
  return undefined;
}

function attr(value: unknown, name: string): string | undefined {
  if (isNode(value) && name in value) return String(value[name]);
  return undefined;
}

/** Kalem toplami = net + KDV (kural #1: decimal.js). */
const sumStrings = (a: string, b: string): string => add(toMoney(a), toMoney(b));
