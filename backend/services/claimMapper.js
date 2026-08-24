const statusLabels = {
  new: 'جدید',
  under_review: 'در حال بررسی',
  needs_action: 'نیاز به اقدام',
  pending_info: 'در انتظار اطلاعات',
  approved: 'تایید شده',
  waiting_poa_draft: 'منتظر تنظیم وکالت‌نامه',
  waiting_passenger_poa_approval: 'منتظر تایید وکالت از سمت مسافر',
  lawyer_action: 'در دست اقدام وکیل',
  waiting_judgment: 'منتظر صدور رأی',
  waiting_enforcement_order: 'منتظر صدور اجرائیه',
  waiting_compensation: 'منتظر دریافت خسارت',
  finance_review: 'در دست بررسی مالی',
  waiting_customer_payment: 'منتظر پرداخت به حساب مشتری',
  rejected: 'رد شده',
  closed: 'بسته شده',
};

export function getClaimStatusLabel(status) {
  return statusLabels[status] || status;
}

const typeLabels = {
  cancellation: 'استرداد وجه',
  delay: 'تاخیر پرواز',
};

export const publicStageTimeline = [
  {
    stage: 1,
    title: 'بررسی اولیه',
    description: 'بررسی اولیه اطلاعات، بلیت و شرایط مشمول بودن پرونده',
  },
  {
    stage: 2,
    title: 'تکمیل مدارک',
    description: 'دریافت و تکمیل مدارک و اطلاعات موردنیاز پرونده',
  },
  {
    stage: 3,
    title: 'تماس و تنظیم وکالت‌نامه',
    description: 'تماس برای دریافت کد تایید و تنظیم یا تایید وکالت‌نامه',
  },
  {
    stage: 4,
    title: 'ثبت دادخواست و رسیدگی قضایی',
    description: 'تهیه و ارسال دادخواست خسارت، طرح دعوا علیه شرکت هواپیمایی و انتظار برای رسیدگی مرجع قضایی',
  },
  {
    stage: 5,
    title: 'صدور رأی قضایی',
    description: 'صدور رأی نهایی یا دستور پرداخت غرامت توسط مرجع قضایی',
  },
  {
    stage: 6,
    title: 'دریافت خسارت',
    description: 'پیگیری وصول مبلغ غرامت تعیین‌شده از شرکت هواپیمایی',
  },
  {
    stage: 7,
    title: 'واریز خسارت و مختومه',
    description: 'بررسی مالی، واریز سهم مسافر و مختومه‌شدن پرونده',
  },
];

function normalizeStage(value) {
  const stage = Number(value || 1);
  if (!Number.isInteger(stage) || stage < 1) return 1;
  if (stage > publicStageTimeline.length) return publicStageTimeline.length;
  return stage;
}

function formatPersianDate(value) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('fa-IR').format(new Date(value));
  } catch {
    return '';
  }
}

function mapFile(file) {
  return {
    id: file.id,
    type: file.type,
    originalName: file.originalName,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    createdAt: file.createdAt,
  };
}

function mapNote(note) {
  return {
    id: note.id,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: note.authorAdmin
      ? {
          id: note.authorAdmin.id,
          username: note.authorAdmin.username,
          name: note.authorAdmin.name || note.authorAdmin.username,
        }
      : null,
  };
}

function parseExtractedData(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function questionnaireOrder(answer) {
  const match = String(answer?.id || answer?.questionId || '').match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function sortQuestionnaire(questionnaire) {
  return [...(questionnaire || [])].sort(
    (left, right) => questionnaireOrder(left) - questionnaireOrder(right),
  );
}

export function mapClaimForPublic(claim) {
  const stage = normalizeStage(claim.stage);
  const currentStage = publicStageTimeline.find((item) => item.stage === stage) || publicStageTimeline[0];

  return {
    trackingCode: claim.trackingCode,
    claimTypeLabel: typeLabels[claim.claimType] || claim.claimType,
    statusText: statusLabels[claim.status] || claim.status,
    stage,
    currentStage,
    stageTimeline: publicStageTimeline,
    updatedAt: claim.updatedAt,
  };
}

export function mapClaimForAdmin(claim) {
  const customerName = claim.customer?.name || '';
  const customerNameParts = customerName.split(/\s+/).filter(Boolean);
  const passengerName =
    claim.passenger?.name ||
    claim.flightInfo?.passengerName ||
    '';

  const expert =
    claim.assignedAdmin?.name ||
    claim.assignedAdmin?.username ||
    '';

  const extractedTicketData = parseExtractedData(claim.extractedTicketData);
  const destination =
    extractedTicketData?.destination ||
    claim.flightInfo?.destination ||
    '';

  return {
    id: claim.id,
    claimCode: claim.trackingCode,
    trackingCode: claim.trackingCode,

    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    regDate: formatPersianDate(claim.createdAt),
    lastUpdate: formatPersianDate(claim.updatedAt),

    customerName: customerName || passengerName || claim.nationalId,
    customerId: claim.customerId || null,
    customerFirstName: customerNameParts[0] || '',
    customerLastName: customerNameParts.slice(1).join(' '),
    customerEmail: claim.customer?.email || '',
    customerPhone: claim.customer?.phoneNumber || claim.phoneNumber || '',
    customerBirthDate: claim.customer?.birthDate || claim.birthDate || '',
    customerNationalId: claim.customer?.nationalId || claim.nationalId || '',
    customerNotes: claim.customer?.notes || '',
    passengerName,

    claimType: claim.claimType,
    claimTypeLabel: typeLabels[claim.claimType] || claim.claimType,

    status: claim.status,
    statusText: statusLabels[claim.status] || claim.status,

    stage: claim.stage || 1,

    expert,
    assignedAdminId: claim.assignedAdminId || null,

    airline: claim.flightInfo?.airline || '',
    flightNumber: claim.flightInfo?.flightNumber || '',
    flightDate: claim.flightInfo?.flightDate || '',
    scheduledTime: claim.flightInfo?.scheduledTime || '',
    flightClass: claim.flightInfo?.flightClass || '',
    pnrCode: claim.flightInfo?.pnrCode || '',
    ticketNumber: claim.flightInfo?.ticketNumber || '',
    ticketIssueDate: extractedTicketData?.issueDate || extractedTicketData?.ticketIssueDate || '',
    ticketAmount: claim.flightInfo?.ticketAmount || '',
    origin: claim.flightInfo?.origin || '',
    destination,

    bankName: claim.bankDetails?.bankName || '',
    cardHolder: claim.bankDetails?.cardHolder || '',
    cardNumber: claim.bankDetails?.cardNumber || '',
    accountNumber: claim.bankDetails?.accountNumber || '',
    sheba: claim.bankDetails?.sheba || '',

    ocrText: claim.flightInfo?.rawText || '',
    extractedTicketData,

    files: (claim.files || []).map(mapFile),

    delayAnswers:
      claim.claimType === 'delay'
        ? sortQuestionnaire(claim.questionnaire)
        : [],

    cancellationAnswers:
      claim.claimType === 'cancellation'
        ? sortQuestionnaire(claim.questionnaire)
        : [],

    statusHistory: claim.statusHistory || [],
    notes: (claim.notes || []).map(mapNote),
  };
}
