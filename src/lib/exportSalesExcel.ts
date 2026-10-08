import type { SaleSheet } from "@/types";

export type SaleRow = SaleSheet & {
  outlet?: { id: string; name: string; area: string | null };
};

const SIZES = ["90", "180", "375", "750", "1000"] as const;
const DIRECT = "Tiger Barrel (Direct sale)";
const BRAND_ORDER = [DIRECT, "MDR", "Derby"];

const GREY = "FF9A9A9A";
const LIGHT = "FFE2E2E2";
const HEAD_BG = "FFF3F3F0";
const ZERO_AS_DASH = '0;-0;"–"';

const side = (argb: string, style: "thin" | "medium" = "thin") => ({
  style,
  color: { argb },
});

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const sumConv = (r: SaleRow) =>
  SIZES.reduce((a, s) => a + (r[`converted_${s}` as const] ?? 0), 0);

export async function exportSalesExcel(rows: SaleRow[], fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // A = brand | B = total contact | C-G = convert | H = total | I-M = not converted
  ws.columns = [
    { width: 32 },
    { width: 14 },
    ...SIZES.map(() => ({ width: 8 })),
    { width: 9 },
    ...SIZES.map(() => ({ width: 8 })),
  ];

  /** merge a range and style every cell in it */
  const put = (
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    value: string | number | null,
    opts: {
      bold?: boolean;
      align?: "left" | "center" | "right";
      fill?: string;
      color?: string;
      numFmt?: string;
      wrap?: boolean;
      bottom?: ReturnType<typeof side>;
    } = {},
  ) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(r, c);
        if (opts.fill)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: opts.fill },
          };
        if (opts.bottom) cell.border = { ...cell.border, bottom: opts.bottom };
      }
    }
    const cell = ws.getCell(r1, c1);
    cell.value = value;
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: !!opts.bold,
      color: opts.color ? { argb: opts.color } : undefined,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: opts.align ?? "left",
      wrapText: !!opts.wrap,
    };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
  };

  const addBorder = (r: number, c: number, b: Record<string, unknown>) => {
    const cell = ws.getCell(r, c);
    cell.border = { ...cell.border, ...b };
  };

  // ---- group rows: one block per outlet + date + promoter ----
  const groups = new Map<string, SaleRow[]>();
  for (const r of rows) {
    const key = `${r.outlet_id}|${r.sale_date}|${r.agent_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  let row = 1;

  for (const list of groups.values()) {
    const first = list[0];

    // brands: defaults first (Direct, MDR, Derby), then the rest A-Z
    const sorted = [...list].sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a.brand_name);
      const ib = BRAND_ORDER.indexOf(b.brand_name);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.brand_name.localeCompare(b.brand_name);
    });

    // ---- header block ----
    const line = side(GREY);
    put(row, 1, row, 1, "Outlet name:", { bold: true });
    put(row, 2, row, 6, first.outlet?.name ?? "—", { bottom: line });
    put(row, 7, row, 8, "Date:", { bold: true, align: "right" });
    put(row, 9, row, 13, fmtDate(first.sale_date), { bottom: line });

    put(row + 1, 1, row + 1, 1, "Promoter name:", { bold: true });
    put(row + 1, 2, row + 1, 6, first.agent?.full_name ?? "—", {
      bottom: line,
    });
    put(row + 1, 7, row + 1, 8, "Brand:", { bold: true, align: "right" });
    put(row + 1, 9, row + 1, 13, "Tiger Barrel", { bottom: line });

    // ---- table header ----
    const h1 = row + 3;
    const h2 = row + 4;
    put(h1, 1, h2, 1, null, { fill: HEAD_BG });
    put(h1, 2, h2, 2, "Total contact", {
      bold: true,
      align: "center",
      wrap: true,
      fill: HEAD_BG,
      color: "FF52514E",
    });
    put(h1, 3, h1, 7, "Convert", {
      bold: true,
      align: "center",
      fill: HEAD_BG,
      bottom: side(GREY),
    });
    put(h1, 8, h2, 8, "Total", {
      bold: true,
      align: "center",
      fill: HEAD_BG,
      color: "FF52514E",
    });
    put(h1, 9, h1, 13, "Not converted", {
      bold: true,
      align: "center",
      fill: HEAD_BG,
      bottom: side(GREY),
    });
    SIZES.forEach((s, i) => {
      put(h2, 3 + i, h2, 3 + i, Number(s), {
        bold: true,
        align: "center",
        fill: HEAD_BG,
        color: "FF52514E",
        bottom: side(GREY),
      });
      put(h2, 9 + i, h2, 9 + i, Number(s), {
        bold: true,
        align: "center",
        fill: HEAD_BG,
        color: "FF52514E",
        bottom: side(GREY),
      });
    });
    ws.getRow(h1).height = 20;
    ws.getRow(h2).height = 20;
    for (let c = 1; c <= 13; c++) addBorder(h2, c, { bottom: side(GREY) });

    // ---- brand rows ----
    let r = h2 + 1;
    const convTot = [0, 0, 0, 0, 0];
    const ncTot = [0, 0, 0, 0, 0];
    let contactTot = 0;
    let convAll = 0;

    for (const b of sorted) {
      const conv = SIZES.map((s) => b[`converted_${s}` as const] ?? 0);
      const nc = SIZES.map((s) => b[`not_converted_${s}` as const] ?? 0);
      const total = conv.reduce((a, x) => a + x, 0);

      put(r, 1, r, 1, b.brand_name, { bold: true });
      put(r, 2, r, 2, b.contact_count, {
        bold: true,
        align: "center",
        numFmt: ZERO_AS_DASH,
      });
      conv.forEach((v, i) => {
        convTot[i] += v;
        put(r, 3 + i, r, 3 + i, v, {
          align: "center",
          numFmt: ZERO_AS_DASH,
          color: v === 0 ? "FFA5A49A" : undefined,
        });
      });
      put(r, 8, r, 8, total, { bold: true, align: "center", numFmt: "0" });
      nc.forEach((v, i) => {
        ncTot[i] += v;
        put(r, 9 + i, r, 9 + i, v, {
          align: "center",
          numFmt: ZERO_AS_DASH,
          color: v === 0 ? "FFA5A49A" : undefined,
        });
      });

      contactTot += b.contact_count;
      convAll += total;
      ws.getRow(r).height = 22;
      for (let c = 1; c <= 13; c++) addBorder(r, c, { bottom: side(LIGHT) });
      r++;
    }

    // ---- total row ----
    const top = side(GREY, "medium");
    put(r, 1, r, 1, "Total", { bold: true });
    put(r, 2, r, 2, contactTot, { bold: true, align: "center", numFmt: "0" });
    convTot.forEach((v, i) =>
      put(r, 3 + i, r, 3 + i, v, { bold: true, align: "center", numFmt: "0" }),
    );
    put(r, 8, r, 8, convAll, { bold: true, align: "center", numFmt: "0" });
    ncTot.forEach((v, i) =>
      put(r, 9 + i, r, 9 + i, v, { bold: true, align: "center", numFmt: "0" }),
    );
    ws.getRow(r).height = 22;
    for (let c = 1; c <= 13; c++) addBorder(r, c, { top });

    // vertical separators (same as the HTML grid): before Total contact, Convert, Total, Not converted
    for (let rr = h1; rr <= r; rr++) {
      for (const c of [2, 3, 8, 9]) addBorder(rr, c, { left: side(GREY) });
    }

    // ---- footer: Direct ----
    const direct = sorted.find((b) => b.brand_name === DIRECT);
    put(r + 2, 1, r + 2, 1, "Direct:", { bold: true });
    put(r + 2, 2, r + 2, 2, direct ? sumConv(direct) : 0, {
      bold: true,
      align: "center",
      numFmt: "0",
    });

    row = r + 5; // gap before next block
  }

  if (groups.size === 0) {
    put(1, 1, 1, 6, "No sales recorded", { bold: true });
  }

  const buf = await wb.xlsx.writeBuffer();
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
