export interface LoanInput {
  principal: number;
  annualRatePercent: number;
  years: number;
  extraMonthlyPayment?: number;
  /** Optional monthly add-ons (mortgage only). Not part of the amortisation. */
  monthlyPropertyTax?: number;
  monthlyInsurance?: number;
  monthlyHoa?: number;
}

export interface LoanResult {
  monthlyPrincipalAndInterest: number;
  monthlyExtras: number;
  monthlyTotal: number;
  totalInterest: number;
  totalPaid: number;
  payoffMonths: number;
  /** Months and interest saved by extra payments, vs. the plain schedule. 0 when there are none. */
  monthsSaved: number;
  interestSaved: number;
  yearly: { year: number; principalPaid: number; interestPaid: number; endBalance: number }[];
}

const cents = (n: number) => Math.round(n * 100) / 100;

function payment(principal: number, annualRatePercent: number, months: number): number {
  const r = annualRatePercent / 100 / 12;
  return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
}

function amortise(principal: number, annualRatePercent: number, months: number, extra: number) {
  const r = annualRatePercent / 100 / 12;
  const pmt = payment(principal, annualRatePercent, months);
  let balance = principal;
  let totalInterest = 0;
  let n = 0;
  const yearly: LoanResult["yearly"] = [];
  let yPrincipal = 0;
  let yInterest = 0;

  while (balance > 0.005 && n < months) {
    n++;
    const interest = balance * r;
    let principalPart = Math.min(pmt - interest + extra, balance);
    if (principalPart < 0) principalPart = 0;
    balance -= principalPart;
    totalInterest += interest;
    yPrincipal += principalPart;
    yInterest += interest;
    if (n % 12 === 0 || balance <= 0.005) {
      yearly.push({ year: Math.ceil(n / 12), principalPaid: cents(yPrincipal), interestPaid: cents(yInterest), endBalance: cents(Math.max(balance, 0)) });
      yPrincipal = 0;
      yInterest = 0;
    }
  }
  return { n, totalInterest, yearly, pmt };
}

export function calculateLoan(input: LoanInput): LoanResult {
  const { principal, annualRatePercent, years, extraMonthlyPayment = 0, monthlyPropertyTax = 0, monthlyInsurance = 0, monthlyHoa = 0 } = input;
  if (!(principal > 0)) throw new RangeError("principal must be greater than 0");
  if (!(annualRatePercent >= 0 && annualRatePercent <= 100)) throw new RangeError("annualRatePercent must be between 0 and 100");
  if (!(years > 0 && years <= 50)) throw new RangeError("years must be between 0 and 50");
  for (const [k, v] of Object.entries({ extraMonthlyPayment, monthlyPropertyTax, monthlyInsurance, monthlyHoa })) {
    if (!(v >= 0)) throw new RangeError(`${k} must be 0 or more`);
  }

  const months = Math.round(years * 12);
  const base = amortise(principal, annualRatePercent, months, 0);
  const actual = extraMonthlyPayment > 0 ? amortise(principal, annualRatePercent, months, extraMonthlyPayment) : base;

  const monthlyExtras = monthlyPropertyTax + monthlyInsurance + monthlyHoa;
  const pi = cents(base.pmt);
  return {
    monthlyPrincipalAndInterest: pi,
    monthlyExtras: cents(monthlyExtras),
    monthlyTotal: cents(pi + monthlyExtras + extraMonthlyPayment),
    totalInterest: cents(actual.totalInterest),
    totalPaid: cents(principal + actual.totalInterest),
    payoffMonths: actual.n,
    monthsSaved: base.n - actual.n,
    interestSaved: cents(base.totalInterest - actual.totalInterest),
    yearly: actual.yearly,
  };
}
