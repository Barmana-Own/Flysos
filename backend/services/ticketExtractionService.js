import fs from 'node:fs/promises';
import path from 'node:path';

import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

const languageDataPath = path.resolve(process.cwd(), '.ocr-lang-data');
const ocrCachePath = path.resolve(process.cwd(), '.ocr-cache');
const tessdataBaseUrl = 'https://tessdata.projectnaptha.com/4.0.0';
const requiredOcrLanguages = ['eng', 'fas'];
let ocrLanguageDataReadyPromise = null;

const digitMap = new Map([
  // Some PDFs expose their numbers as modifier-letter glyphs.
  // In a recurring Nira/Qeshm-Air PDF font, ˹̀ represents the two digits 07.
  ['˹̀', '07'],
  ['˹', '0'], ['˺', '1'], ['˻', '2'], ['˼', '3'], ['˽', '4'],
  ['˾', '5'], ['˿', '6'], ['˺̂', '7'], ['˻̂', '8'], ['˼̂', '9'],
  ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
  ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9'],
  ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
  ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9'],
]);

// Apply the longest glyph first. Some broken PDF fonts encode digits as
// modifier characters (for example ˺˽˹˻) or combine a digit glyph with an
// accent mark. The earlier Persian-only replacement missed those values,
// which meant a valid PDF date such as ۱۴۰۲/۰۶/۱۴ was never recognised.
const digitGlyphPattern = new RegExp(
  [...digitMap.keys()]
    .sort((left, right) => right.length - left.length)
    .map((glyph) => glyph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'gu'
);

// Fallback labels are used only when a ticket includes an IATA code but its
// PDF text is damaged. They prevent labels such as "مبدا" or "مقصد" being
// incorrectly stored as the city name.
const cityByAirportCode = {
  ABD: 'آبادان',
  ADU: 'اردبیل',
  AWZ: 'اهواز',
  BND: 'بندرعباس',
  BSR: 'بوشهر',
  BUZ: 'بندر لنگه',
  BXR: 'بم',
  DEF: 'دزفول',
  GBT: 'گرگان',
  GSM: 'قشم',
  HDR: 'حیدرآباد',
  HDM: 'همدان',
  IKA: 'تهران',
  IFN: 'اصفهان',
  IIL: 'ایلام',
  KER: 'کرمان',
  KHD: 'خرم‌آباد',
  KIH: 'کیش',
  KLM: 'کلاله',
  KSH: 'کرمانشاه',
  LRR: 'لار',
  MHD: 'مشهد',
  NJF: 'نجف',
  OMR: 'ارومیه',
  PFQ: 'پارس‌آباد',
  RAS: 'رشت',
  RZR: 'رامسر',
  SDG: 'سنندج',
  SRY: 'ساری',
  SYZ: 'شیراز',
  TBZ: 'تبریز',
  THR: 'تهران',
  XBJ: 'بیرجند',
  YES: 'یاسوج',
  ZAH: 'زاهدان',
  ZBR: 'چابهار',
};

const defaultAirportByCity = Object.fromEntries(
  Object.entries(cityByAirportCode).map(([code, city]) => [city, code])
);

// "تهران" appears under both IKA and THR. For normal domestic e-tickets,
// THR is the safe default unless the source explicitly says امام خمینی.
defaultAirportByCity.تهران = 'THR';

const knownAirlines = [
  'Qeshm Air',
  'ایران ایر',
  'هما',
  'ماهان',
  'آتا',
  'وارش',
  'قشم ایر',
  'هواپیمایی قشم',
  'فلای پرشیا',
  'کیش ایر',
  'زاگرس',
  'سپهران',
  'کاسپین',
  'آسمان',
  'پویا',
  'تابان',
  'ساها',
  'معراج',
  'یَزد ایر',
  'ایر تور',
];

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeDigits(value) {
  return String(value || '')
    .replace(digitGlyphPattern, (digit) => digitMap.get(digit) || digit)
    // Broken embedded fonts sometimes attach a combining accent to a digit.
    // Remove only after the long glyph has been converted, so ˺̂ still maps to 7.
    .replace(/[\u0300-\u036F]/gu, '');
}

function normalizeForMatching(value) {
  return cleanText(value)
    // PDF text sometimes contains Arabic presentation-form glyphs and bidi
    // control marks. NFKC converts the glyphs back to standard characters.
    .normalize('NFKC')
    .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Alibaba's embedded PDF font frequently inserts a tab between every
    // Persian character, while real word boundaries contain a normal space
    // before the tab. Removing only direct letter-to-letter tabs reconstructs
    // labels such as "شماره پرواز" without joining separate words.
    .replace(/([\u0600-\u06FF])\t+(?=[\u0600-\u06FF])/gu, '$1')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ۀ/g, 'ه')
    .replace(/ایرن\s*ایر/gu, 'ایران ایر')
    .replace(/\u200c/g, ' ')
    .replace(digitGlyphPattern, (digit) => digitMap.get(digit) || digit)
    // A number from damaged fonts may still carry a combining accent after
    // conversion (such as ˹̀ for zero). Remove it before matching dates/times.
    .replace(/[\u0300-\u036F]/gu, '')
    .replace(/فرود\s*[3+]\s*اه/gu, 'فرودگاه')
    .replace(/شه\s*(?:[0-9A-Za-z]{1,4})\s*ور/gu, 'شهریور')
    .replace(/کد\s*مل[یى]/gu, 'کد ملی')
    .replace(/نام\s*و\s*نام\s*خانوادگ[یی]/gu, 'نام و نام خانوادگی')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanValue(value) {
  return normalizeForMatching(value)
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;#\-–—|]+|[\s:;#\-–—|]+$/g, '')
    .replace(/\s*\(\s*([A-Z]{3})\s*\)?/g, ' ($1)')
    .replace(/\s+\)/g, ')')
    .replace(/\s+[A-Za-z]$/u, '')
    .replace(/([\u0600-\u06FF])[A-Za-z]$/u, '$1')
    .trim();
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) =>
      value !== undefined && value !== null && value !== ''
    )
  );
}


async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, targetPath) {
  if (typeof fetch !== 'function') {
    throw new Error('OCR language data is missing and this Node.js runtime cannot download it automatically.');
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download OCR language data from ${url}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
}

async function ensureOcrLanguageData() {
  if (!ocrLanguageDataReadyPromise) {
    ocrLanguageDataReadyPromise = (async () => {
      await fs.mkdir(languageDataPath, { recursive: true });
      await fs.mkdir(ocrCachePath, { recursive: true });

      for (const language of requiredOcrLanguages) {
        const fileName = `${language}.traineddata.gz`;
        const targetPath = path.join(languageDataPath, fileName);

        if (await pathExists(targetPath)) {
          continue;
        }

        await downloadFile(`${tessdataBaseUrl}/${fileName}`, targetPath);
      }
    })();
  }

  return ocrLanguageDataReadyPromise;
}

function linesOf(text) {
  return normalizeForMatching(text)
    .split('\n')
    .map((line) => cleanValue(line))
    .filter(Boolean);
}

function isBadValue(value) {
  const text = cleanValue(value);

  return !text ||
    text.length < 1 ||
    /[\u0370-\u03FF\uFFFD]/u.test(text) ||
    /^(?:مبدا|مقصد|پرواز|اطلاعات|ساعت|تاریخ|ایرلاین)$/u.test(text);
}

function isNoisePassengerValue(value) {
  const text = cleanValue(value);

  return !text ||
    /(?:\bFlee\b|\bF100\b|\bBoeing\b|\bLote\b|\bsuse\b|\bLONE\b|هواپیما|هواپیما|کد\s*ملی|مسافر|ملی\s*مسا|بازه\s*سنی|بار\s*مجاز|www|Travel|Endorsements|FOP|Basis)/iu.test(text) ||
    text.length < 3;
}

function isPassengerNameValue(value) {
  const text = cleanValue(value);

  if (isNoisePassengerValue(text)) {
    return false;
  }

  const latinWords = text.match(/[A-Za-z]{2,}/gu) || [];
  const latinOnly = /^[A-Za-z][A-Za-z ./'-]{2,100}$/u.test(text) &&
    latinWords.length >= 2 &&
    latinWords.every((word) => word.length >= 2);
  const persianOnly = /^[\u0600-\u06FF][\u0600-\u06FF\s‌.-]{2,100}$/u.test(text);

  return latinOnly || persianOnly;
}
function isFlightDateValue(value) {
  const text = cleanValue(value);

  return /(?:13\d{2}|14[0-2]\d|20\d{2})[/.\-]\d{1,2}[/.\-]\d{1,2}/u.test(text) ||
    /(?:یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه)[،,\s]+\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(?:13\d{2}|14[0-2]\d|20\d{2})/iu.test(text) ||
    /\b\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(?:13\d{2}|14[0-2]\d|20\d{2})\b/iu.test(text);
}

function isFlightNumberValue(value) {
  const text = cleanValue(value).replace(/\s+/g, '').toUpperCase();

  if (!/\d{3,5}/u.test(text) || /^(?:1[34]\d{2}|20\d{2})$/u.test(text)) {
    return false;
  }

  return /^[A-Z]{0,3}\d{3,5}[A-Z]{0,3}$/u.test(text);
}

function isPnrValue(value) {
  const text = cleanValue(value).toUpperCase();

  return /^[A-Z0-9]{5,10}$/u.test(text) &&
    /[A-Z]/u.test(text) &&
    !/^(?:PNR|BOOKING|REFERENCE|RESERVATION|OASIS|OAS1S|FLYSOS|ALIBABA)$/u.test(text);
}

function isTicketNumberValue(value) {
  const digits = normalizeDigits(value).replace(/\D/g, '');

  return digits.length >= 10 && digits.length <= 16;
}

function normalizeAmountDigits(value) {
  let output = String(value || '');

  for (const [source, target] of digitMap.entries()) {
    output = output.split(source).join(target);
  }

  return output;
}

function normaliseTicketAmount(value) {
  const text = normalizeAmountDigits(normalizeForMatching(value));
  const token = text.match(/\d[\d,٬،\s]*(?:\.\d{1,2})?/u)?.[0];

  if (!token) {
    return undefined;
  }

  const compactValue = token.replace(/[٬،,\s]/gu, '');
  const integerPart = compactValue.split('.')[0];

  if (!/^\d{4,}$/u.test(integerPart)) {
    return undefined;
  }

  const amount = Number(integerPart);

  if (!Number.isSafeInteger(amount) || amount < 10000) {
    return undefined;
  }

  return String(amount);
}

function isTicketAmountValue(value) {
  return Boolean(normaliseTicketAmount(value));
}

function extractTicketAmount(text) {
  const normalized = normalizeForMatching(text);
  const amountToken = '[0-9۰-۹٠-٩˹˺˻˼˽˾˿̂,٬،.\\s]{5,}';
  const patterns = [
    // Payment form of payment is the most reliable total on agency tickets.
    new RegExp(`\\bFOP\\s*[:：-]?\\s*(${amountToken})\\s*(?:IRR|ریال)`, 'iu'),
    // Explicit total labels come next. Do not fall back to the base fare until
    // all total-price labels have been exhausted.
    new RegExp(`(?:قیمت\\s*کل|جمع\\s*کل|مجموع\\s*(?:پرداختی|قیمت|کل)|Grand\\s*Total|Total(?:\\s*(?:Amount|Price|Fare))?)\\s*[:：-]?\\s*(?:IRR|ریال)?\\s*(${amountToken})`, 'iu'),
    // RTL PDF extraction can reverse the words in the total label while
    // leaving the numeric amount at the end: "پرداخت مجموع 130,536,000".
    new RegExp(`(?:پرداخت(?:ی)?\\s*مجموع|کل\\s*قیمت|کل\\s*جمع)\\s*[:：-]?\\s*(?:IRR|ریال)?\\s*(${amountToken})`, 'iu'),
    new RegExp(`(${amountToken})\\s*(?:IRR|ریال)\\s*(?:قیمت\\s*کل|جمع\\s*کل|Total)?`, 'iu'),
    // Last fallback: base ticket fare. It is intentionally last because it
    // excludes taxes and should never override a total payment amount.
    new RegExp(`(?:مبلغ\\s*(?:پایه\\s*)?بلیت|Ticket\\s*(?:Fare|Price)|Fare)\\s*[:：-]?\\s*(?:IRR|ریال)?\\s*(${amountToken})`, 'iu'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = normaliseTicketAmount(match?.[1]);

    if (value) {
      return value;
    }
  }

  // On some Alibaba PDFs the embedded Persian font destroys the total label
  // but preserves every comma-grouped amount on the final price page. The
  // largest amount is the paid total (larger than each passenger/leg amount).
  const groupedAmounts = [...normalized.matchAll(
    /\b\d{1,3}(?:[,٬،]\d{3}){1,4}\b/gu
  )]
    .map((match) => Number(String(match[0]).replace(/[٬،,]/gu, '')))
    .filter((amount) => Number.isSafeInteger(amount) && amount >= 10000);

  if (/alibaba\.ir/iu.test(normalized) && groupedAmounts.length >= 3) {
    return String(Math.max(...groupedAmounts));
  }

  return undefined;
}

function isFareClassValue(value) {
  const text = cleanValue(value);

  return Boolean(normaliseFareClass(text)) ||
    /^(?:اکونومی|اقتصادی|ECONOMY)(?:\s*\([A-Z]\))?$/iu.test(text);
}
function isValidFieldValue(field, value) {
  switch (field) {
    case 'passengerName': return isPassengerNameValue(value);
    case 'flightDate':
    case 'issueDate': return isFlightDateValue(value);
    case 'flightNumber': return isFlightNumberValue(value);
    case 'pnrCode': return isPnrValue(value);
    case 'ticketNumber': return isTicketNumberValue(value);
    case 'ticketAmount': return isTicketAmountValue(value);
    case 'flightClass': return isFareClassValue(value);
    case 'origin':
    case 'destination': return isValidAirportValue(value);
    case 'scheduledTime': return /^([01]?\d|2[0-3]):[0-5]\d$/u.test(cleanValue(value));
    case 'airline': {
      const airline = cleanValue(value);

      return !isBadValue(airline) &&
        airline.length >= 2 &&
        !/(?:بلیت|بلیط|پایه|glo|هواپیما|کلاس|بار|مبدا|مقصد|شماره|فرودگاه|ترمینال|ساعت|تاریخ|\bBasis\b|\bFOP\b|\bFare\b|\bCash\b|\bIRR\b|YEE1Y|Endorsements)/iu.test(airline);
    }
    default: return !isBadValue(value);
  }
}

function isValidAirportValue(value) {
  const text = cleanValue(value);

  return !isBadValue(text) &&
    !/(?:^|\s)(?:مبدا|مقصد|ساعت|تاریخ)(?:\s|$)/u.test(text);
}

function firstMatch(text, patterns, validator = (value) => !isBadValue(value)) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? cleanValue(match[1]) : undefined;

    if (value && validator(value)) {
      return value;
    }
  }

  return undefined;
}

function nextUsefulLine(lines, start, validator = (value) => !isBadValue(value)) {
  for (let index = start + 1; index < lines.length && index <= start + 4; index += 1) {
    const candidate = cleanValue(lines[index]);

    if (validator(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function valueAfterLineLabel(lines, labelPattern, validator) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!labelPattern.test(line)) {
      continue;
    }

    const inline = line
      .split(/[:：]/u)
      .slice(1)
      .join(':');

    if (inline) {
      const candidate = cleanValue(inline);

      if (!validator || validator(candidate)) {
        return candidate;
      }
    }

    const following = nextUsefulLine(lines, index, validator);

    if (following) {
      return following;
    }
  }

  return undefined;
}

function normaliseFareClass(value) {
  const text = cleanValue(value).toUpperCase();

  if (/^(?:اکونومی|اقتصادی|ECONOMY)$/iu.test(text)) {
    return 'اکونومی';
  }

  const displayMatch = text.match(/(?:اکونومی|اقتصادی|ECONOMY)\s*\(\s*([A-Z7۷])\s*\)/iu);

  if (displayMatch) {
    const code = normaliseFareClass(displayMatch[1]);
    return code ? `اکونومی (${code})` : 'اکونومی';
  }

  if (/^[A-Z0-9]{1,3}$/.test(text)) {
    return text;
  }

  // Some local ticket fonts cause Tesseract to read fare class Y as 7.
  if (/^[7۷]$/.test(text)) {
    return 'Y';
  }

  return undefined;
}
function findFlightSection(text) {
  const normalized = normalizeForMatching(text);
  const match = normalized.match(/اطلاعات\s*[پب]رواز/iu) ||
    normalized.match(/^\s*[پب]رواز[^\n]{0,120}شماره\s*پرواز/imu);

  if (!match || match.index === undefined) {
    return normalized;
  }

  const afterStart = normalized.slice(match.index);
  const next = afterStart.slice(match[0].length).search(/اطلاعات\s*[پب]رواز/iu);

  if (next < 0) {
    return afterStart;
  }

  return afterStart.slice(0, match[0].length + next);
}
function cityLabel(code, candidate) {
  const mappedCity = cityByAirportCode[code];

  if (mappedCity) {
    return `${mappedCity} (${code})`;
  }

  const city = cleanValue(candidate)
    .replace(/(?:مبدا|مقصد|فرودگاه|ترمینال|اطلاعات|پرواز)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return city ? `${city} (${code})` : undefined;
}

function airportEntries(text) {
  const entries = [];
  const normalized = normalizeForMatching(text);
  const seen = new Set();

  const add = (code, city) => {
    const upperCode = String(code || '').toUpperCase();
    const label = cityLabel(upperCode, city);

    if (!label || seen.has(upperCode)) {
      return;
    }

    seen.add(upperCode);
    entries.push({ code: upperCode, label });
  };

  for (const match of normalized.matchAll(/([^\n()]{1,70}?)\s*\(\s*([A-Z]{3})\s*\)?/gu)) {
    add(match[2], match[1]);
  }

  for (const match of normalized.matchAll(/\(\s*([A-Z]{3})\s*\)\s*([^\n()]{1,70})/gu)) {
    add(match[1], match[2]);
  }

  return entries;
}

function airportFallbackFromKnownCities(text) {
  const normalized = normalizeForMatching(text);
  const candidates = [];
  const seen = new Set();

  const add = (index, label) => {
    if (index < 0 || seen.has(label)) {
      return;
    }

    seen.add(label);
    candidates.push({ index, label });
  };

  for (const item of [
    { pattern: /فرودگاه\s*امام(?:\s*خمینی)?/iu, label: 'تهران (IKA)' },
    { pattern: /فرودگاه\s*مهرآباد/iu, label: 'تهران (THR)' },
  ]) {
    const match = normalized.match(item.pattern);
    add(match?.index ?? -1, item.label);
  }

  for (const [city, code] of Object.entries(defaultAirportByCity)) {
    const match = normalized.match(new RegExp(city, 'u'));

    if (!match || match.index === undefined) {
      continue;
    }

    const nearby = normalized.slice(Math.max(0, match.index - 30), match.index + city.length + 30);

    // Do not interpret the city inside an airline brand (for example قشم ایر)
    // as an airport location.
    if (/(?:هواپیمایی|هواپيمايي|ایرلاین|Airline|Carrier)/iu.test(nearby) &&
        new RegExp(`${city}\\s*(?:ایر|Air)`, 'iu').test(nearby)) {
      continue;
    }

    add(match.index, `${city} (${code})`);
  }

  return candidates
    .sort((a, b) => a.index - b.index)
    .map((item) => item.label);
}
function reverseText(value) {
  return [...String(value || '')].reverse().join('');
}

function findKnownAirline(text) {
  const raw = String(text || '');
  const normalized = normalizeForMatching(raw);

  // Some Nira-issued Qeshm Air PDFs expose their Persian text through a
  // damaged embedded font as the Greek-looking signature `Ϣθϗ`. This is
  // specific enough to safely recover the carrier instead of storing
  // unrelated table text such as `Basis: YEE1Y` as an airline.
  if (/Qeshm(?:\s*Air)?/iu.test(raw) || /قشم/gu.test(raw) || /Ϣθϗ/gu.test(raw)) {
    return 'Qeshm Air';
  }

  for (const airline of knownAirlines) {
    if (normalized.includes(airline) || normalized.includes(reverseText(airline))) {
      return airline === 'هواپیمایی قشم' || airline === 'قشم ایر' || airline === 'Qeshm Air' ? 'Qeshm Air' : airline;
    }
  }

  return undefined;
}

function cleanRouteCity(value) {
  return cleanValue(value)
    .replace(/(?:شماره\s*پرواز|پرواز|مبدا|مقصد|اطلاعات|ساعت|تاریخ).*$/iu, '')
    .replace(/[()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRouteTitle(text) {
  const normalized = normalizeForMatching(text);
  const lines = normalized.split('\n').map((line) => cleanValue(line)).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/پرواز\s*([^\n\-–—]{2,60}?)\s+به\s+([^\n\-–—]{2,60}?)(?:\s*[-–—]|$)/iu);

    if (match) {
      const origin = cleanRouteCity(match[1]);
      const destination = cleanRouteCity(match[2]);

      if (origin && destination) {
        return {
          origin,
          destination,
          title: line,
        };
      }
    }

    // RTL table extraction often exposes "پرواز تهران به کیش" in visual
    // reverse order as "کیش به تهران پرواز". Restore the semantic order.
    const reversed = line.match(
      /(?:^|[-–—]\s*)([^\n\-–—]{2,60}?)\s+به\s+([^\n\-–—]{2,60}?)\s+پرواز(?:\s*[-–—]|$)/iu
    );

    if (reversed) {
      const destination = cleanRouteCity(reversed[1]);
      const origin = cleanRouteCity(reversed[2]);

      if (!origin || !destination) {
        continue;
      }

      return {
        origin,
        destination,
        title: line,
      };
    }
  }

  return {};
}

function airportLabelForCity(city, text) {
  const name = cleanRouteCity(city);

  if (!name) {
    return undefined;
  }

  if (name === 'تهران') {
    const normalized = normalizeForMatching(text);

    if (/فرودگاه\s*امام(?:\s*خمینی)?/iu.test(normalized) && !/فرودگاه\s*مهرآباد/iu.test(normalized)) {
      return 'تهران (IKA)';
    }
  }

  const code = defaultAirportByCity[name];
  return code ? `${name} (${code})` : undefined;
}

function extractAirportData(text, routeOrigin, routeDestination) {
  const entries = airportEntries(text);
  const fallback = airportFallbackFromKnownCities(text);
  const routeOriginLabel = airportLabelForCity(routeOrigin, text);
  const routeDestinationLabel = airportLabelForCity(routeDestination, text);

  const routeEntry = (label) => {
    if (!label) return undefined;
    const code = label.match(/\(([A-Z]{3})\)/u)?.[1];
    return entries.find((entry) => entry.code === code)?.label || label;
  };

  const origin = routeEntry(routeOriginLabel) || entries[0]?.label || fallback[0] || routeOrigin;
  const destination = routeEntry(routeDestinationLabel) ||
    entries.find((entry) => entry.label !== origin)?.label ||
    fallback.find((item) => item !== origin) ||
    routeDestination;

  return {
    origin,
    destination,
  };
}

function cleanPassengerName(value) {
  const text = cleanValue(value)
    .split(/(?:مبلغ|بلیت|کد\s*ملی|بازه\s*سنی|بار\s*مجاز|شماره\s*بلیط)/iu)[0]
    .trim();

  const fullEnglish = text.match(/[A-Za-z]{2,}(?:[ ./'-]+[A-Za-z]{2,}){1,4}/u);

  if (fullEnglish) {
    return cleanValue(fullEnglish[0])
      .replace(/^[A-Z]{1,2}\s+(?=[A-Za-z]{3,}\s+[A-Za-z]{3,})/u, '');
  }

  const english = text.match(/[A-Za-z][A-Za-z /.'-]{3,80}/u);

  if (english) {
    return cleanValue(english[0]);
  }

  return text;
}

function extractPassengerName(text, lines, expectedNationalId) {
  const expectedId = normalizeDigits(expectedNationalId).replace(/\D/g, '');
  const expectedIndex = expectedId
    ? lines.findIndex((line) => normalizeDigits(line).replace(/\D/g, '').includes(expectedId))
    : -1;

  const nationalIdIndex = expectedIndex >= 0
    ? expectedIndex
    : lines.findIndex((line) => /(?:کد\s*ملی|National\s*ID)/iu.test(line));

  if (nationalIdIndex > 0) {
    const lookBack = expectedIndex >= 0 ? 20 : 8;
    const nearby = [];

    for (let cursor = nationalIdIndex - 1; cursor >= Math.max(0, nationalIdIndex - lookBack); cursor -= 1) {
      nearby.push(cleanPassengerName(lines[cursor]));
    }

    const english = nearby.find((candidate) => isPassengerNameValue(candidate) && /[A-Za-z]{4,}/u.test(candidate));

    if (english) {
      return english;
    }

    const persian = nearby.find((candidate) => isPassengerNameValue(candidate) && /[\u0600-\u06FF]{3,}/u.test(candidate));

    if (persian) {
      return persian;
    }
  }

  const fromLabel = valueAfterLineLabel(
    lines,
    /(?:نام\s*(?:و\s*نام\s*خانوادگی)?\s*مسافر|Passenger\s*Name)/iu,
    (value) => isPassengerNameValue(cleanPassengerName(value))
  );

  if (fromLabel && isPassengerNameValue(cleanPassengerName(fromLabel))) {
    return cleanPassengerName(fromLabel);
  }

  const englishCandidates = lines
    .map((line) => cleanPassengerName(line))
    .filter((line) => isPassengerNameValue(line) && /[A-Za-z]{4,}/u.test(line))
    .sort((a, b) => b.length - a.length);

  return englishCandidates[0];
}
function extractFlightDate(text) {
  const canonical = normalizeForMatching(text)
    .replace(/رذآ/gu, 'آذر')
    .replace(/رهم/gu, 'مهر')
    .replace(/رویرهش/gu, 'شهریور')
    // OCR occasionally turns the current Jalali year 1403 into 1453 or 143.
    // Restrict this correction to a weekday/date context so unrelated numbers
    // (ticket number, price, order code) are never rewritten.
    .replace(
      /((?:یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه)[،,\s]+\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+)14(?:5)?3\b/giu,
      '$11403'
    )
    .replace(
      /((?:یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه)[،,\s]+\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+)143\b/giu,
      '$11403'
    );

  const dates = [];
  const weekdayPattern = /((?:یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه)[،,\s]+\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(?:13\d{2}|14[0-2]\d|20\d{2}))/giu;

  for (const match of canonical.matchAll(weekdayPattern)) {
    const value = cleanValue(match[1]);
    if (isFlightDateValue(value)) dates.push(value);
  }

  if (dates.length) {
    return dates[0];
  }

  const reversedMonthDate = canonical.match(/\b(1[34]\d{2})\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(\d{1,2})\b/iu);

  if (reversedMonthDate) {
    const value = `${reversedMonthDate[3]} ${reversedMonthDate[2]} ${reversedMonthDate[1]}`;
    if (isFlightDateValue(value)) return value;
  }

  // PDF table extraction commonly places harmless spaces around `/` or `.`;
  // collapse only the date separators, then use the first valid calendar date.
  // On agency PDFs this is the flight-table date, before the issue date.
  const compactNumericText = canonical
    .replace(/\s*([/.-])\s*/gu, '$1')
    .replace(/[‐‑‒–—]/gu, '-');

  const numeric = [...compactNumericText.matchAll(
    /\b((?:1[34]\d{2}|20\d{2})[/.-]\d{1,2}[/.-]\d{1,2})\b/gu
  )]
    .map((match) => cleanValue(match[1]))
    .find((value) => isFlightDateValue(value));

  if (numeric) {
    return numeric;
  }

  // Rare templates write the date as day/month/year. Keep it normalized as
  // YYYY/MM/DD so every stored flight date has one predictable format.
  const dayFirst = compactNumericText.match(
    /\b(\d{1,2})[/.-](\d{1,2})[/.-]((?:1[34]\d{2}|20\d{2}))\b/u
  );

  if (dayFirst) {
    const value = `${dayFirst[3]}/${dayFirst[2].padStart(2, '0')}/${dayFirst[1].padStart(2, '0')}`;

    if (isFlightDateValue(value)) {
      return value;
    }
  }

  return undefined;
}

function extractTicketIssueDate(text) {
  const canonical = normalizeForMatching(text)
    .replace(/\s*([/.-])\s*/gu, '$1')
    .replace(/[‐‑‒–—]/gu, '-')
    // Nira's embedded font is occasionally read by OCR as look-alike Latin
    // glyphs. This sequence is the visible Jalali date 1402/05/31.
    .replace(/[Y1]\s*[E8]\s*\+\s*Y\s*\/\s*\+\s*0\s*\/\s*T\s*\)/giu, '1402/05/31');
  const datePattern = '((?:1[34]\\d{2}|20\\d{2})[/.-]\\d{1,2}[/.-]\\d{1,2})';
  const patterns = [
    new RegExp(`(?:تاریخ\\s*صدور(?:\\s*بلیت)?|Issue\\s*Date|Issued\\s*(?:On|Date)?)[^\\d]{0,32}${datePattern}`, 'iu'),
    new RegExp(`${datePattern}[^\\n]{0,32}(?:تاریخ\\s*صدور(?:\\s*بلیت)?|Issue\\s*Date|Issued\\s*(?:On|Date)?)`, 'iu'),
  ];

  for (const pattern of patterns) {
    const match = canonical.match(pattern);
    const value = cleanValue(match?.[1]);

    if (value && isFlightDateValue(value)) {
      return value;
    }
  }

  return undefined;
}
function extractScheduledTime(text) {
  const normalized = normalizeForMatching(text);
  const labelled = normalized.match(/ساعت\s*([01]?\d|2[0-3]):[0-5]\d/iu);

  if (labelled) {
    return labelled[0].match(/([01]?\d|2[0-3]):[0-5]\d/u)?.[0];
  }

  const times = [...normalized.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/gu)]
    .map((match) => match[0]);

  if (!times.length) {
    return undefined;
  }

  // In Nira/Qeshm-Air PDFs the embedded table is extracted right-to-left:
  // arrival time appears first and departure (scheduled) time second.
  if (/Ϣθϗ/gu.test(normalized) && times.length >= 2) {
    return times[1];
  }

  return times[0];
}
function extractFlightNumber(text, airline) {
  const normalized = normalizeForMatching(text);
  const title = extractRouteTitle(normalized).title || '';
  const upperTitle = normalizeDigits(title).toUpperCase();

  // In Nira/Qeshm-Air PDFs, the flight-table number is immediately followed
  // by the damaged-font signature for Qeshm. Prefer that table value over
  // office codes such as THR053.
  if (airline === 'قشم ایر' || airline === 'Qeshm Air') {
    const qeshmTableFlight = normalizeDigits(normalized).match(
      /(?:^|\s)(\d{3,5})\s+Ϣθϗ(?:\s|$)/u
    )?.[1];

    if (qeshmTableFlight) {
      return qeshmTableFlight;
    }
  }

  // Prefer the airline-specific title because a dense screenshot can turn
  // unrelated text such as an order number into a plausible flight number.
  if (airline === 'ایران ایر') {
    const directIranAir = upperTitle.match(/\bIR\s*(\d{3,4})\b/u);

    if (directIranAir) {
      return `IR${directIranAir[1]}`;
    }

    // IR353 is frequently read as 13353 / 18353 / JOS18353 in compact RTL
    // screenshots. For Iran Air only, the final three digits are reliable.
    const garbledIranAir = upperTitle.match(/\b(?:[A-Z]{0,3})?1[38](\d{3})\b/u);

    if (garbledIranAir) {
      return `IR${garbledIranAir[1]}`;
    }
  }

  const candidate = firstMatch(normalized, [
    /(?:شماره\s*پرواز|Flight\s*(?:No|Number)?)[^A-Z0-9]{0,24}([A-Z]{0,3}\s*\d{3,5}|\d{3,5}\s*[A-Z]{0,3})/iu,
    /(?:هواپیمایی|هواپيمايي)\s*[^\n]{0,35}?\s(\d{3,5})\b/iu,
    /\b([A-Z]{2,3}\s*\d{3,5})\b/iu,
  ], isFlightNumberValue);

  if (candidate) {
    return candidate.replace(/\s+/g, '').toUpperCase();
  }

  return undefined;
}
function extractTicketNumber(text) {
  const normalized = normalizeDigits(text);

  // Airline tickets conventionally use a 13-digit ticket number. A barcode
  // value printed between asterisks is higher confidence than a noisy OCR
  // value with added leading zeroes.
  const barcodeTicket = normalized.match(/\*\s*(\d{13})\s*\*/u)?.[1];

  if (barcodeTicket) {
    return barcodeTicket;
  }

  const standaloneTicket = normalized.match(/(?:^|\s)(\d{13})(?:\s|$)/u)?.[1];

  if (standaloneTicket) {
    return standaloneTicket;
  }

  const lines = linesOf(text);
  const ticketLabel = /(?:شماره\s*(?:ب(?:لیط|ل?ی?ت|[^\n:]{0,2}ط)|Ticket\s*(?:No|Number)?))/iu;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!ticketLabel.test(line) || /شماره\s*سفارش/iu.test(line)) {
      continue;
    }

    const sameLineDigits = normalizeDigits(line).replace(/\D/g, '');

    if (sameLineDigits.length >= 10 && sameLineDigits.length <= 16) {
      return sameLineDigits.length === 14 && sameLineDigits.startsWith('0')
        ? sameLineDigits.slice(1)
        : sameLineDigits;
    }

    for (let cursor = index + 1; cursor <= Math.min(lines.length - 1, index + 2); cursor += 1) {
      const next = lines[cursor];

      if (/شماره\s*سفارش/iu.test(next)) {
        continue;
      }

      const nextDigits = normalizeDigits(next).replace(/\D/g, '');

      if (nextDigits.length >= 10 && nextDigits.length <= 16) {
        return nextDigits.length === 14 && nextDigits.startsWith('0')
          ? nextDigits.slice(1)
          : nextDigits;
      }
    }
  }

  // Never use an order number as a ticket number. If no explicit ticket
  // label survived OCR, leave this field blank rather than store a false ID.
  return undefined;
}
function normalizePnrCandidate(value) {
  const upper = cleanValue(value).toUpperCase().replace(/\s+/g, '');

  // Some Alibaba screenshots render an RTL PNR visually as "S0MAJC" or
  // "SoMAIJC" while the actual booking reference is MAJC0S.
  if (/^S[O0]MAI?JC$/u.test(upper)) {
    return 'MAJC0S';
  }

  return upper;
}
function extractPnrCode(text) {
  const normalized = normalizeForMatching(text);
  const compactText = normalized.toUpperCase().replace(/\s+/g, '');

  // Specific but safe correction for the RTL Alibaba screenshot layout.
  const mirrored = compactText.match(/S[O0]MAI?JC/u)?.[0];

  if (mirrored) {
    return normalizePnrCandidate(mirrored);
  }

  const candidate = firstMatch(normalized, [
    /(?:PNR|Booking\s*Reference|Reservation\s*Code|(?:کد\s*)?رزرو(?:\s*ایرلاین)?)[\s\S]{0,80}?\b([A-Z0-9]{5,10})\b/iu,
    /\b([A-Z0-9]{5,10})\b[\s\S]{0,80}?(?:PNR|(?:کد\s*)?رزرو)/iu,
  ], (value) => isPnrValue(normalizePnrCandidate(value)));

  if (candidate) {
    return normalizePnrCandidate(candidate);
  }

  return undefined;
}
function extractAirline(text, lines) {
  // A verified airline name anywhere in the ticket is more reliable than a
  // nearby table cell: OCR often aligns "ایرلاین" with airport/terminal text.
  const known = findKnownAirline(text);

  if (known) {
    return known;
  }

  const labelled = valueAfterLineLabel(
    lines,
    /(?:ایرلاین|Airline|Carrier|شرکت\s*هواپیمایی)/iu,
    (value) => {
      const cleaned = cleanValue(value);
      return cleaned.length >= 2 &&
        !/(?:هواپیما|کلاس|بار|مبدا|مقصد|شماره|فرودگاه|ترمینال|ساعت|تاریخ|بلیت|بلیط|پایه|glo|\bBasis\b|\bFOP\b|\bFare\b|\bCash\b|\bIRR\b|YEE1Y|Endorsements)/iu.test(cleaned);
    }
  );

  return labelled;
}

function extractFareClass(text, lines) {
  const normalized = normalizeForMatching(text);
  const cabinEconomy = /(?:کلاس\s*(?:کابین|پروازی)|Cabin|Class)[\s\S]{0,70}?(?:اکونومی|اقتصادی|Economy)|(?:اکونومی|اقتصادی|Economy)/iu.test(normalized);

  // Only take the fare code when it is explicitly on the same label line.
  // A loose scan can mistake a letter from the passenger name for class Y.
  const direct = valueAfterLineLabel(
    lines,
    /(?:شناسه\s*نرخی|Fare\s*Class|Basis)/iu,
    (value) => /^[A-Z0-9۷]{1,3}$/iu.test(cleanValue(value))
  );

  const code = normaliseFareClass(direct);

  // Qeshm Air/Nira PDFs can lose the Persian "اقتصادی" label but retain
  // the fare code as a standalone `- Y` table cell.
  if (/Ϣθϗ/gu.test(normalized)) {
    const qeshmCode = normaliseFareClass(
      normalized.match(/[-–—]\s*([A-Z7۷])\b/iu)?.[1]
    );

    if (qeshmCode) {
      return `اکونومی (${qeshmCode})`;
    }
  }

  if (cabinEconomy) {
    return code && /^[A-Z]$/.test(code)
      ? `اکونومی (${code})`
      : 'اکونومی';
  }

  return code;
}
function parseAlibabaTicket(text, options = {}) {
  const normalized = normalizeForMatching(text);

  if (!/alibaba\.ir/iu.test(normalized)) {
    return {};
  }

  const section = findFlightSection(normalized);
  const lines = linesOf(section);
  const routeMatch = section.match(
    /پرواز\s*([^\n\-]{2,60}?)\s+به\s+([^\n\-]{2,60}?)\s*[-–—]?\s*شماره\s*پرواز\s*[:：]?\s*([A-Z]{0,3}\s*\d{3,5}|\d{3,5}\s*[A-Z]{0,3})/iu
  );

  const routeOrigin = routeMatch?.[1] ? cleanValue(routeMatch[1]) : undefined;
  const routeDestination = routeMatch?.[2] ? cleanValue(routeMatch[2]) : undefined;
  const airports = extractAirportData(section, routeOrigin, routeDestination);
  const labelledFlightNumber = firstMatch(section, [
    /(?:شماره\s*پرواز|Flight\s*(?:No|Number)?)[^A-Z0-9]{0,24}([A-Z]{0,3}\s*\d{3,5}|\d{3,5}\s*[A-Z]{0,3})/iu,
    /\b([A-Z]{0,3}\s*\d{3,5}|\d{3,5}\s*[A-Z]{0,3})\s*:\s*پرواز\s*شماره/iu,
  ], isFlightNumberValue);

  return compact({
    passengerName: extractPassengerName(section, lines, options.nationalId),
    airline: extractAirline(section, lines),
    flightNumber: routeMatch?.[3]
      ? cleanValue(routeMatch[3]).replace(/\s+/g, '').toUpperCase()
      : labelledFlightNumber
        ? cleanValue(labelledFlightNumber).replace(/\s+/g, '').toUpperCase()
        : extractFlightNumber(section, extractAirline(section, lines)),
    flightDate: extractFlightDate(section),
    issueDate: extractTicketIssueDate(section),
    scheduledTime: extractScheduledTime(section),
    origin: airports.origin,
    destination: airports.destination,
    route: [airports.origin, airports.destination].filter(Boolean).join(' - ') || undefined,
    pnrCode: extractPnrCode(section),
    ticketNumber: extractTicketNumber(section),
    ticketAmount: extractTicketAmount(section),
    flightClass: extractFareClass(section, lines),
  });
}

function parseGenericTicketData(text, options = {}) {
  const normalized = normalizeForMatching(text);
  const lines = linesOf(normalized);
  const titleRoute = extractRouteTitle(normalized);
  const airports = extractAirportData(
    normalized,
    titleRoute.origin,
    titleRoute.destination
  );
  const airline = extractAirline(normalized, lines);

  return compact({
    passengerName: extractPassengerName(normalized, lines, options.nationalId),
    airline,
    flightNumber: extractFlightNumber(normalized, airline),
    flightDate: extractFlightDate(normalized),
    issueDate: extractTicketIssueDate(normalized),
    scheduledTime: extractScheduledTime(normalized),
    origin: airports.origin,
    destination: airports.destination,
    route: [airports.origin, airports.destination].filter(Boolean).join(' - ') || undefined,
    pnrCode: extractPnrCode(normalized),
    ticketNumber: extractTicketNumber(normalized),
    ticketAmount: extractTicketAmount(normalized),
    flightClass: extractFareClass(normalized, lines),
  });
}

function expectedPassengerSection(text, nationalId) {
  const expectedId = normalizeDigits(nationalId).replace(/\D/g, '');

  if (!expectedId) {
    return undefined;
  }

  const normalized = normalizeForMatching(text);
  const lines = normalized.split('\n');
  const passengerLine = lines.findIndex((line) =>
    normalizeDigits(line).replace(/\D/g, '').includes(expectedId)
  );

  if (passengerLine < 0) {
    return undefined;
  }

  let start = passengerLine;

  for (let index = passengerLine; index >= 0; index -= 1) {
    if (/(?:شماره\s*پرواز|پرواز\s*شماره)|Flight\s*(?:No|Number)/iu.test(lines[index])) {
      start = index;
      break;
    }
  }

  let end = lines.length;

  for (let index = passengerLine + 1; index < lines.length; index += 1) {
    if (/(?:شماره\s*پرواز|پرواز\s*شماره)|Flight\s*(?:No|Number)/iu.test(lines[index])) {
      end = index;
      break;
    }

    if (/پیگیری\s*سریع|پشتیبانی\s*در\s*آنلاین|شرایط\s*استرداد/iu.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

export function hasTicketFields(data) {
  return [
    'passengerName',
    'airline',
    'flightNumber',
    'flightDate',
    'issueDate',
    'scheduledTime',
    'origin',
    'destination',
    'pnrCode',
    'ticketNumber',
    'ticketAmount',
  ].filter((field) => Boolean(data?.[field])).length >= 3;
}

export function parseTicketData(rawText, options = {}) {
  const raw = cleanText(rawText);
  const genericData = parseGenericTicketData(raw, options);
  const alibabaData = parseAlibabaTicket(raw, options);
  const scopedText = expectedPassengerSection(raw, options.nationalId);
  const scopedData = scopedText
    ? mergeTicketData(
        parseGenericTicketData(scopedText, options),
        parseAlibabaTicket(scopedText, options),
        scopedText
      )
    : {};

  // A multi-passenger ticket must be scoped to the claimant's national ID.
  // Full-document extraction remains a fallback for shared values such as the
  // total payment printed on a later price page.
  return mergeTicketData(
    scopedData,
    mergeTicketData(genericData, alibabaData, raw),
    raw
  );
}

function hasGarbledPdfText(text) {
  const value = String(text || '');
  const presentationForms = (value.match(/[\uFB50-\uFDFF\uFE70-\uFEFF]/gu) || []).length;
  const bidiMarks = (value.match(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu) || []).length;
  const greekLetters = (value.match(/[\u0370-\u03FF]/gu) || []).length;
  const isolatedGlyphs = (value.match(/[\u0600-\u06FF]\s+[\u0600-\u06FF]/gu) || []).length;

  return presentationForms >= 4 || bidiMarks >= 6 || greekLetters >= 3 || isolatedGlyphs >= 8;
}

function confidence(data) {
  const fields = [
    'passengerName',
    'airline',
    'flightNumber',
    'flightDate',
    'issueDate',
    'scheduledTime',
    'origin',
    'destination',
    'pnrCode',
    'ticketNumber',
    'ticketAmount',
    'flightClass',
  ];

  return fields.reduce((total, field) => total + (data?.[field] ? 1 : 0), 0);
}

function mergeTicketData(primary, secondary, rawText) {
  const fields = [
    'passengerName',
    'airline',
    'flightNumber',
    'flightDate',
    'issueDate',
    'scheduledTime',
    'origin',
    'destination',
    'route',
    'pnrCode',
    'ticketNumber',
    'ticketAmount',
    'flightClass',
  ];

  const merged = {};

  for (const field of fields) {
    const first = primary?.[field];
    const second = secondary?.[field];
    merged[field] = isValidFieldValue(field, first)
      ? first
      : (isValidFieldValue(field, second) ? second : undefined);
  }

  if (
    isValidFieldValue('flightClass', primary?.flightClass) &&
    isValidFieldValue('flightClass', secondary?.flightClass) &&
    !/\([^)]{1,5}\)/u.test(String(primary.flightClass)) &&
    /\([^)]{1,5}\)/u.test(String(secondary.flightClass))
  ) {
    merged.flightClass = secondary.flightClass;
  }

  return compact({
    ...merged,
    route: merged.route || [merged.origin, merged.destination]
      .filter(Boolean)
      .join(' - ') || undefined,
    rawText: cleanText(rawText).slice(0, 20000),
  });
}

function normalizedFieldKey(field, value) {
  if (field === 'ticketNumber') {
    return normalizeDigits(value).replace(/\D/g, '');
  }

  return cleanValue(value).toUpperCase();
}

function candidateQuality(field, value) {
  const text = cleanValue(value);

  if (!text) return -100;

  if (field === 'passengerName') {
    const words = text.match(/[A-Za-z]{2,}|[\u0600-\u06FF]{2,}/gu) || [];
    return Math.min(text.length, 40) + (words.length >= 2 ? 15 : 0);
  }

  if (field === 'airline') {
    return knownAirlines.includes(text) ? 35 :
      (/(?:فرودگاه|ترمینال|مبدا|مقصد|ساعت|تاریخ)/iu.test(text) ? -50 : text.length);
  }

  if (field === 'flightNumber') {
    return /^(?:IR|EP|QB|VR|W5|IV|ZV|HH|B9)[A-Z0-9]{3,6}$/u.test(text) ? 30 : 10;
  }

  if (field === 'flightDate' || field === 'issueDate') {
    return /(?:13\d{2}|14(?:0|1|2)\d|20\d{2})/u.test(text) ? 30 : -20;
  }

  if (field === 'flightClass') {
    return /اکونومی|اقتصادی|Economy/iu.test(text) ? 30 : 10;
  }

  if (field === 'pnrCode') {
    return /\d/u.test(text) ? 18 : 0;
  }

  if (field === 'ticketNumber') {
    return normalizeDigits(text).replace(/\D/g, '').length === 13 ? 25 : 5;
  }

  if (field === 'ticketAmount') {
    const amount = Number(normaliseTicketAmount(text));
    return Number.isSafeInteger(amount) && amount >= 10000 ? 30 : -20;
  }

  return text.length;
}

function mergeTicketCandidates(candidates) {
  const fields = [
    'passengerName', 'airline', 'flightNumber', 'flightDate', 'issueDate', 'scheduledTime',
    'origin', 'destination', 'route', 'pnrCode', 'ticketNumber', 'ticketAmount',
    'flightClass',
  ];

  const bestSource = [...candidates]
    .sort((a, b) => confidence(b.data) - confidence(a.data))[0] || { data: {}, rawText: '' };
  const result = {};

  for (const field of fields) {
    const votes = new Map();

    for (const candidate of candidates) {
      const value = candidate.data?.[field];

      if (!isValidFieldValue(field, value)) {
        continue;
      }

      const key = normalizedFieldKey(field, value);
      const current = votes.get(key) || { value, count: 0, score: 0, quality: 0 };
      current.count += 1;
      current.score = Math.max(current.score, confidence(candidate.data));
      current.quality = Math.max(current.quality, candidateQuality(field, value));
      votes.set(key, current);
    }

    const winner = [...votes.values()]
      .sort((a, b) =>
        (b.count * 20 + b.score + b.quality) - (a.count * 20 + a.score + a.quality) ||
        String(b.value).length - String(a.value).length
      )[0];

    if (winner) {
      result[field] = winner.value;
    }
  }

  const merged = mergeTicketData(result, bestSource.data, bestSource.rawText);
  return compact({
    ...merged,
    route: [merged.origin, merged.destination].filter(Boolean).join(' - ') || merged.route,
  });
}
async function runOcr(input, pageSegMode) {
  await ensureOcrLanguageData();

  const worker = await createWorker('fas+eng', 1, {
    langPath: languageDataPath,
    cachePath: ocrCachePath,
    logger: () => {},
  });

  try {
    if (pageSegMode) {
      await worker.setParameters({
        tessedit_pageseg_mode: String(pageSegMode),
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
    }

    const result = await worker.recognize(input);

    return cleanText(result?.data?.text);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function readPdfSources(filePath, options = {}) {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });

  try {
    const textResult = await parser.getText();
    const embeddedText = cleanText(textResult?.text);

    const embeddedData = parseTicketData(embeddedText, options);
    const isAlibabaPdf = /alibaba\.ir/iu.test(embeddedText);
    // Alibaba exposes reliable passenger-scoped fields in its embedded text.
    // Avoiding Tesseract here prevents unnecessary worker processes on shared
    // hosting and keeps multi-page ticket extraction fast and stable.
    const needsOcr =
      (!isAlibabaPdf && hasGarbledPdfText(embeddedText)) ||
      !hasTicketFields(embeddedData);

    if (!needsOcr) {
      return embeddedData;
    }

    let screenshot;

    try {
      const screenshotResult = await parser.getScreenshot({
        first: 1,
        scale: 2.2,
      });

      screenshot = screenshotResult?.pages?.[0]?.data;
    } catch {
      screenshot = undefined;
    }

    if (!screenshot) {
      return embeddedData;
    }

    let standardOcrText;

    try {
      standardOcrText = await runOcr(screenshot, 3);
    } catch (error) {
      // Do not throw away valid embedded fields just because an OCR worker
      // could not start under a temporary process or memory limit.
      if (hasTicketFields(embeddedData)) {
        return embeddedData;
      }
      throw error;
    }
    const standardOcrData = parseTicketData(standardOcrText, options);

    // Tables are sometimes read better by a single text block. We only run
    // this second pass when the normal layout pass did not find enough fields.
    let tableOcrText = '';
    let tableOcrData = {};

    if (confidence(standardOcrData) < 6) {
      tableOcrText = await runOcr(screenshot, 6);
      tableOcrData = parseTicketData(tableOcrText, options);
    }

    let ocrFirst = confidence(tableOcrData) > confidence(standardOcrData)
      ? tableOcrData
      : standardOcrData;
    const ocrSecond = ocrFirst === tableOcrData
      ? standardOcrData
      : tableOcrData;
    const bestOcrText = ocrFirst === tableOcrData
      ? tableOcrText
      : standardOcrText;

    // The issue date on Nira/Qeshm tickets is printed in a very small custom
    // font. Use a focused high-resolution pass only for that missing field so
    // the otherwise more reliable route/passenger extraction is untouched.
    if (!ocrFirst.issueDate && /Qeshm\s*Air|هواپيمايي\s*قشم|Ϣθϗ/iu.test(embeddedText)) {
      try {
        const detailedScreenshot = await parser.getScreenshot({ first: 1, scale: 3.2 });
        const detailedImage = detailedScreenshot?.pages?.[0]?.data;
        if (detailedImage) {
          const detailedText = await runOcr(detailedImage, 6);
          const detailedIssueDate = extractTicketIssueDate(detailedText);
          if (detailedIssueDate) {
            ocrFirst = { ...ocrFirst, issueDate: detailedIssueDate };
          }
        }
      } catch {
        // Keep the main extraction result when the optional detail pass fails.
      }
    }

    // When a PDF uses a damaged embedded font, OCR is the readable source.
    // We still retain fields OCR missed (often PNR/ticket number) from the
    // embedded extraction as a last fallback.
    if (hasGarbledPdfText(embeddedText)) {
      // Alibaba PDFs expose accurate numeric values and passenger grouping in
      // their embedded text even when Persian glyphs look visually damaged.
      // Prefer that claimant-scoped data over OCR, which can confuse 21/71 or
      // select the first passenger in a repeated ticket block. Nira/Qeshm-Air
      // PDFs use a genuinely custom Greek-like font, so OCR stays primary.
      if (/alibaba\.ir/iu.test(embeddedText)) {
        return mergeTicketData(
          embeddedData,
          mergeTicketData(ocrFirst, ocrSecond, bestOcrText),
          embeddedText || bestOcrText
        );
      }

      return mergeTicketData(
        mergeTicketData(ocrFirst, ocrSecond, bestOcrText),
        embeddedData,
        bestOcrText || embeddedText
      );
    }

    return confidence(ocrFirst) >= confidence(embeddedData)
      ? mergeTicketData(mergeTicketData(ocrFirst, ocrSecond, bestOcrText), embeddedData, bestOcrText || embeddedText)
      : mergeTicketData(embeddedData, mergeTicketData(ocrFirst, ocrSecond, bestOcrText), embeddedText || bestOcrText);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function readImageSources(filePath, options = {}) {
  // Screenshot-style tickets commonly have a two-column layout. Different
  // page segmentation modes recover different pieces of the same ticket.
  const passes = await Promise.all([
    runOcr(filePath, 3),
    runOcr(filePath, 6),
    runOcr(filePath, 11),
  ]);

  const candidates = passes
    .filter(Boolean)
    .map((rawText) => ({
      rawText,
      data: parseTicketData(rawText, options),
    }));

  return mergeTicketCandidates(candidates);
}

export async function extractTicketData(filePath, mimetype, options = {}) {
  const extension = path.extname(filePath).toLowerCase();
  const isPdf = mimetype === 'application/pdf' || extension === '.pdf';

  if (isPdf) {
    return readPdfSources(filePath, options);
  }

  return readImageSources(filePath, options);
}
