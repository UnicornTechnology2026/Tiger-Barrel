import type { SaleSheet } from "@/types";

export type SaleRow = SaleSheet & {
  outlet?: { id: string; name: string; area: string | null };
};

type WS = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

const SIZES = ["90", "180", "375", "750", "1000"] as const;
const DIRECT = "Tiger's Barrel (Direct sale)";
const BRAND_ORDER = [DIRECT, "Master Delight", "Derby"];

/* ───────── Palette ───────── */
const C = {
  title: "FF5C0F17", // deep burgundy
  head: "FF8B1A1A", // table header
  gold: "FFF2B705",
  white: "FFFFFFFF",
  convHead: "FF1F7A4D",
  convSub: "FFE3F3EA",
  ncHead: "FFB42318",
  ncSub: "FFFBE6E3",
  totalHead: "FF3F3F46",
  totalSub: "FFECECEE",
  band: "FFFAF6F3",
  line: "FFE3DAD5",
  text: "FF1F2937",
  muted: "FF6B7280",
  good: "FF1F7A4D",
  warn: "FFB45309",
  bad: "FFB42318",
};

const NUM = '#,##0;-#,##0;"–"';
const NUM_PLAIN = "#,##0";
const PCT = "0%";

/* ───────── Helpers ───────── */

const thin = (argb = C.line) => ({ style: "thin" as const, color: { argb } });

function utcDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(iso: string) {
  return utcDate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtNow() {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rate = (conv: number, nc: number) =>
  conv + nc === 0 ? 0 : conv / (conv + nc);

function rateColor(p: number) {
  if (p >= 0.6) return C.good;
  if (p >= 0.4) return C.warn;
  return C.bad;
}

interface CellStyle {
  bold?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  numFmt?: string;
  wrap?: boolean;
  border?: boolean;
}

function style(cell: Cell, s: CellStyle = {}) {
  cell.font = {
    name: "Calibri",
    size: s.size ?? 11,
    bold: !!s.bold,
    color: { argb: s.color ?? C.text },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: s.align ?? "left",
    wrapText: !!s.wrap,
    indent: s.align === undefined || s.align === "left" ? 1 : 0,
  };
  if (s.fill)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: s.fill },
    };
  if (s.numFmt) cell.numFmt = s.numFmt;
  if (s.border)
    cell.border = {
      top: thin(),
      bottom: thin(),
      left: thin(),
      right: thin(),
    };
}

function banner(ws: WS, lastCol: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = title;
  style(t, { bold: true, size: 18, color: C.white, fill: C.title });
  ws.getRow(1).height = 36;

  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  style(s, { size: 10, color: C.white, fill: C.title });
  ws.getRow(2).height = 20;

  // gold accent strip
  for (let c = 1; c <= lastCol; c++) {
    ws.getCell(3, c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: C.gold },
    };
  }
  ws.getRow(3).height = 4;
}

function download(buf: ArrayBuffer, fileName: string) {
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ───────── Export ───────── */

export async function exportSalesExcel(rows: SaleRow[], fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tiger's Barrel";
  wb.created = new Date();

  // ---- sort: newest date, outlet, promoter, brand (defaults first) ----
  const sorted = [...rows].sort((a, b) => {
    if (a.sale_date !== b.sale_date) return a.sale_date < b.sale_date ? 1 : -1;
    const o = (a.outlet?.name ?? "").localeCompare(b.outlet?.name ?? "");
    if (o) return o;
    const p = (a.agent?.full_name ?? "").localeCompare(
      b.agent?.full_name ?? "",
    );
    if (p) return p;
    const ia = BRAND_ORDER.indexOf(a.brand_name);
    const ib = BRAND_ORDER.indexOf(b.brand_name);
    if (ia !== -1 || ib !== -1)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.brand_name.localeCompare(b.brand_name);
  });

  // ---- period / counts for subtitle ----
  const dates = sorted.map((r) => r.sale_date).sort();
  const period =
    dates.length === 0
      ? "No data"
      : dates[0] === dates[dates.length - 1]
        ? fmtDate(dates[0])
        : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;
  const outletCount = new Set(sorted.map((r) => r.outlet_id)).size;
  const promoterCount = new Set(sorted.map((r) => r.agent_id)).size;
  const subtitle = `Period: ${period}   |   ${sorted.length} entries · ${outletCount} outlets · ${promoterCount} promoters   |   Generated: ${fmtNow()}`;

  /* ═════════════ Sheet 1: Sales Report (flat table) ═════════════ */
  const ws = wb.addWorksheet("Sales Report", {
    properties: { tabColor: { argb: C.head } },
    views: [{ state: "frozen", xSplit: 2, ySplit: 5, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // A Date | B Outlet | C Area | D Promoter | E Brand | F Contacts
  // G-K Converted | L Total conv | M-Q Not converted | R Total not conv | S Conv %
  const LAST = 19;
  ws.columns = [
    { width: 14 },
    { width: 30 },
    { width: 20 },
    { width: 22 },
    { width: 30 },
    { width: 11 },
    ...SIZES.map(() => ({ width: 8.5 })),
    { width: 12 },
    ...SIZES.map(() => ({ width: 8.5 })),
    { width: 12 },
    { width: 13 },
  ];

  banner(ws, LAST, "Tiger's Barrel — Sales Report", subtitle);

  // ---- header row 4 (groups) ----
  const G = 4;
  const H = 5;
  for (let c = 1; c <= LAST; c++) {
    const fill =
      c >= 7 && c <= 11
        ? C.convHead
        : c >= 13 && c <= 17
          ? C.ncHead
          : c === 12 || c === 18 || c === 19
            ? C.totalHead
            : C.head;
    style(ws.getCell(G, c), { fill, color: C.white, bold: true });
  }
  ws.mergeCells(G, 7, G, 11);
  ws.getCell(G, 7).value = "CONVERTED (bottle size)";
  style(ws.getCell(G, 7), {
    fill: C.convHead,
    color: C.white,
    bold: true,
    align: "center",
  });
  ws.mergeCells(G, 13, G, 17);
  ws.getCell(G, 13).value = "NOT CONVERTED (bottle size)";
  style(ws.getCell(G, 13), {
    fill: C.ncHead,
    color: C.white,
    bold: true,
    align: "center",
  });
  ws.getRow(G).height = 22;

  // ---- header row 5 (columns) ----
  const labels: (string | number)[] = [
    "Date",
    "Outlet",
    "Area",
    "Promoter",
    "Brand",
    "Contacts",
    ...SIZES.map(Number),
    "Total Converted",
    ...SIZES.map(Number),
    "Total Not Converted",
    "Conversion %",
  ];
  labels.forEach((label, i) => {
    const c = i + 1;
    const isSize = typeof label === "number";
    const isConv = c >= 7 && c <= 11;
    const isNc = c >= 13 && c <= 17;
    const cell = ws.getCell(H, c);
    cell.value = label;
    style(cell, {
      bold: true,
      wrap: true,
      align: c <= 5 ? "left" : "center",
      color: isSize ? C.text : C.white,
      fill: isConv
        ? C.convSub
        : isNc
          ? C.ncSub
          : c === 12 || c === 18 || c === 19
            ? C.totalHead
            : C.head,
      numFmt: isSize ? '0"ml"' : undefined,
      border: true,
    });
  });
  ws.getRow(H).height = 32;

  // ---- data rows ----
  const first = H + 1;
  const T = { contact: 0, conv: SIZES.map(() => 0), nc: SIZES.map(() => 0) };
  const brandAgg = new Map<
    string,
    { contact: number; conv: number; nc: number }
  >();
  const promAgg = new Map<
    string,
    { outlets: Set<string>; contact: number; conv: number; nc: number }
  >();

  sorted.forEach((r, idx) => {
    const row = first + idx;
    const conv = SIZES.map((s) => r[`converted_${s}` as const] ?? 0);
    const nc = SIZES.map((s) => r[`not_converted_${s}` as const] ?? 0);
    const convTotal = conv.reduce((a, x) => a + x, 0);
    const ncTotal = nc.reduce((a, x) => a + x, 0);
    const pct = rate(convTotal, ncTotal);
    const band = idx % 2 === 1 ? C.band : undefined;

    T.contact += r.contact_count ?? 0;
    conv.forEach((v, i) => (T.conv[i] += v));
    nc.forEach((v, i) => (T.nc[i] += v));

    const b = brandAgg.get(r.brand_name) ?? { contact: 0, conv: 0, nc: 0 };
    b.contact += r.contact_count ?? 0;
    b.conv += convTotal;
    b.nc += ncTotal;
    brandAgg.set(r.brand_name, b);

    const pk = r.agent?.full_name ?? "Unknown";
    const p = promAgg.get(pk) ?? {
      outlets: new Set<string>(),
      contact: 0,
      conv: 0,
      nc: 0,
    };
    p.outlets.add(r.outlet_id);
    p.contact += r.contact_count ?? 0;
    p.conv += convTotal;
    p.nc += ncTotal;
    promAgg.set(pk, p);

    const put = (c: number, value: unknown, s: CellStyle = {}) => {
      const cell = ws.getCell(row, c);
      cell.value = value as never;
      style(cell, { fill: band, border: true, ...s });
    };

    put(1, utcDate(r.sale_date), { align: "left", numFmt: "dd-mmm-yyyy" });
    put(2, r.outlet?.name ?? "—", { bold: true });
    put(3, r.outlet?.area ?? "—", { color: C.muted });
    put(4, r.agent?.full_name ?? "—");
    put(5, r.brand_name, { bold: r.brand_name === DIRECT });
    put(6, r.contact_count ?? 0, { align: "center", bold: true, numFmt: NUM });
    conv.forEach((v, i) =>
      put(7 + i, v, {
        align: "center",
        numFmt: NUM,
        color: v === 0 ? C.muted : C.text,
      }),
    );
    put(
      12,
      { formula: `SUM(G${row}:K${row})`, result: convTotal },
      { align: "center", bold: true, numFmt: NUM, fill: band ?? C.totalSub },
    );
    nc.forEach((v, i) =>
      put(13 + i, v, {
        align: "center",
        numFmt: NUM,
        color: v === 0 ? C.muted : C.text,
      }),
    );
    put(
      18,
      { formula: `SUM(M${row}:Q${row})`, result: ncTotal },
      { align: "center", bold: true, numFmt: NUM, fill: band ?? C.totalSub },
    );
    put(
      19,
      {
        formula: `IF(L${row}+R${row}=0,0,L${row}/(L${row}+R${row}))`,
        result: pct,
      },
      {
        align: "center",
        bold: true,
        numFmt: PCT,
        color: rateColor(pct),
        fill: band ?? C.totalSub,
      },
    );
    ws.getRow(row).height = 20;
  });

  // ---- total row (SUBTOTAL: respects filters) ----
  if (sorted.length > 0) {
    const last = first + sorted.length - 1;
    const tr = last + 1;
    const convSum = T.conv.reduce((a, x) => a + x, 0);
    const ncSum = T.nc.reduce((a, x) => a + x, 0);

    for (let c = 1; c <= LAST; c++) {
      const cell = ws.getCell(tr, c);
      style(cell, {
        bold: true,
        color: C.white,
        fill: C.title,
        align: "center",
      });
      cell.border = { top: { style: "medium", color: { argb: C.gold } } };
    }
    ws.getCell(tr, 1).value = "TOTAL";
    ws.getCell(tr, 1).alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };

    const sub = (c: number, result: number) => {
      const col = ws.getColumn(c).letter;
      const cell = ws.getCell(tr, c);
      cell.value = {
        formula: `SUBTOTAL(109,${col}${first}:${col}${last})`,
        result,
      };
      cell.numFmt = NUM_PLAIN;
    };
    sub(6, T.contact);
    T.conv.forEach((v, i) => sub(7 + i, v));
    sub(12, convSum);
    T.nc.forEach((v, i) => sub(13 + i, v));
    sub(18, ncSum);
    const pc = ws.getCell(tr, 19);
    pc.value = {
      formula: `IF(L${tr}+R${tr}=0,0,L${tr}/(L${tr}+R${tr}))`,
      result: rate(convSum, ncSum),
    };
    pc.numFmt = PCT;
    ws.getRow(tr).height = 26;

    ws.autoFilter = {
      from: { row: H, column: 1 },
      to: { row: last, column: LAST },
    };
  } else {
    ws.mergeCells(first, 1, first, LAST);
    const e = ws.getCell(first, 1);
    e.value = "No sales recorded";
    style(e, { color: C.muted, align: "center" });
    ws.getRow(first).height = 28;
  }

  ws.pageSetup.printTitlesRow = `${G}:${H}`;
  ws.headerFooter = {
    oddFooter: "&L&8Tiger's Barrel — Sales Report&R&8Page &P of &N",
  };

  /* ═════════════ Sheet 2: Summary ═════════════ */
  const sm = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: C.gold } },
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sm.columns = [
    { width: 34 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
  ];
  banner(sm, 6, "Tiger's Barrel — Sales Summary", subtitle);

  const convAll = T.conv.reduce((a, x) => a + x, 0);
  const ncAll = T.nc.reduce((a, x) => a + x, 0);

  /** heading + header row + body rows + total row. Returns next free row. */
  const section = (
    start: number,
    heading: string,
    headers: string[],
    body: (string | number)[][],
    total: (string | number)[],
    opts: { lastColIsRate?: boolean; totalFmt?: string } = {},
  ) => {
    const lastIsRate = opts.lastColIsRate ?? true;

    sm.mergeCells(start, 1, start, headers.length);
    const h = sm.getCell(start, 1);
    h.value = heading;
    style(h, { bold: true, size: 13, color: C.title });
    sm.getRow(start).height = 26;

    const hr = start + 1;
    headers.forEach((t, i) => {
      const cell = sm.getCell(hr, i + 1);
      cell.value = t;
      style(cell, {
        bold: true,
        color: C.white,
        fill: C.head,
        align: i === 0 ? "left" : "center",
        wrap: true,
        border: true,
      });
    });
    sm.getRow(hr).height = 28;

    body.forEach((vals, ri) => {
      const rr = hr + 1 + ri;
      const band = ri % 2 === 1 ? C.band : undefined;
      vals.forEach((v, ci) => {
        const isRate = lastIsRate && ci === vals.length - 1;
        const cell = sm.getCell(rr, ci + 1);
        cell.value = v;
        style(cell, {
          fill: band,
          border: true,
          bold: ci === 0 || isRate,
          align: ci === 0 ? "left" : "center",
          numFmt: ci === 0 ? undefined : isRate ? PCT : NUM,
          color: isRate && typeof v === "number" ? rateColor(v) : undefined,
        });
      });
      sm.getRow(rr).height = 20;
    });

    const tr = hr + 1 + body.length;
    total.forEach((v, ci) => {
      const isRate = lastIsRate && ci === total.length - 1;
      const cell = sm.getCell(tr, ci + 1);
      cell.value = v;
      style(cell, {
        bold: true,
        color: C.white,
        fill: C.title,
        align: ci === 0 ? "left" : "center",
        numFmt:
          ci === 0 ? undefined : (opts.totalFmt ?? (isRate ? PCT : NUM_PLAIN)),
      });
    });
    sm.getRow(tr).height = 24;
    return tr + 2;
  };

  let next = 5;

  next = section(
    next,
    "Overall",
    ["Metric", "Value"],
    [
      ["Total contacts", T.contact],
      ["Converted", convAll],
      ["Not converted", ncAll],
    ],
    ["Conversion rate", rate(convAll, ncAll)],
    { lastColIsRate: false, totalFmt: PCT },
  );

  const brandRows = [...brandAgg.entries()]
    .sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a[0]);
      const ib = BRAND_ORDER.indexOf(b[0]);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a[0].localeCompare(b[0]);
    })
    .map(([name, v]) => [name, v.contact, v.conv, v.nc, rate(v.conv, v.nc)]);
  next = section(
    next,
    "By brand",
    ["Brand", "Contacts", "Converted", "Not converted", "Conversion %"],
    brandRows,
    ["Total", T.contact, convAll, ncAll, rate(convAll, ncAll)],
  );

  const promRows = [...promAgg.entries()]
    .sort((a, b) => b[1].conv - a[1].conv)
    .map(([name, v]) => [
      name,
      v.outlets.size,
      v.contact,
      v.conv,
      v.nc,
      rate(v.conv, v.nc),
    ]);
  section(
    next,
    "By promoter",
    [
      "Promoter",
      "Outlets",
      "Contacts",
      "Converted",
      "Not converted",
      "Conversion %",
    ],
    promRows,
    ["Total", outletCount, T.contact, convAll, ncAll, rate(convAll, ncAll)],
  );

  const buf = await wb.xlsx.writeBuffer();
  download(buf as ArrayBuffer, fileName);
}
