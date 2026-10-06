const monthlyRent = document.querySelector("#monthly-rent");
const months = document.querySelector("#months");
const extraIncome = document.querySelector("#extra-income");
const spouseThreshold = document.querySelector("#spouse-threshold");
const error = document.querySelector("#calculator-error");
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
const wholePln = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

function toGrosz(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
  return BigInt(Math.round(amount * 100));
}

function formatGrosz(grosz) {
  return money.format(Number(grosz) / 100);
}

function formatWholeZloty(grosz) {
  return `${wholePln.format(Number(grosz / 100n))} zł`;
}

function roundTaxBase(grosz) {
  return ((grosz + 50n) / 100n) * 100n;
}

function updateTax() {
  const monthlyGrosz = toGrosz(monthlyRent.value);
  const otherGrosz = toGrosz(extraIncome.value);
  const monthCount = Number(months.value);
  const valid = monthlyGrosz !== null && otherGrosz !== null &&
    Number.isInteger(monthCount) && monthCount >= 1 && monthCount <= 12;

  error.hidden = valid;
  if (!valid) {
    for (const id of ["revenue-result", "lower-band-result", "upper-band-result", "tax-result", "threshold-remaining-result"])
      document.querySelector(`#${id}`).textContent = "—";
    return;
  }

  const revenueGrosz = monthlyGrosz * BigInt(monthCount) + otherGrosz;
  const taxableBaseGrosz = roundTaxBase(revenueGrosz);
  const thresholdGrosz = BigInt(spouseThreshold.checked ? 200_000 : 100_000) * 100n;
  const lowerBandGrosz = taxableBaseGrosz < thresholdGrosz ? taxableBaseGrosz : thresholdGrosz;
  const upperBandGrosz = taxableBaseGrosz - lowerBandGrosz;
  const taxNumerator = lowerBandGrosz * 85n + upperBandGrosz * 125n;
  const taxGrosz = ((taxNumerator + 50_000n) / 100_000n) * 100n;
  const remainingGrosz = revenueGrosz < thresholdGrosz ? thresholdGrosz - revenueGrosz : 0n;

  document.querySelector("#revenue-result").textContent = formatGrosz(revenueGrosz);
  document.querySelector("#lower-band-result").textContent = formatGrosz(lowerBandGrosz);
  document.querySelector("#upper-band-result").textContent = formatGrosz(upperBandGrosz);
  document.querySelector("#tax-result").textContent = formatWholeZloty(taxGrosz);
  document.querySelector("#threshold-remaining-result").textContent = formatGrosz(remainingGrosz);
}

for (const input of [monthlyRent, months, extraIncome, spouseThreshold])
  input.addEventListener("input", updateTax);

updateTax();
