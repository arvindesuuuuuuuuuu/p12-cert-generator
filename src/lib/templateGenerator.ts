/**
 * Template generator & demo data utility.
 * Produces a sample .xlsx file with column headers and example rows,
 * and provides instant demo datasets for browser testing.
 */

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { CertRow } from "@/types";

export const DEMO_ROWS: CertRow[] = [
  {
    index: 0,
    filename: "alilylipio",
    commonName: "ALILY T. LIPIO",
    p12Password: "City@Accounting2026",
    organization: "CITY ACCOUNTING OFFICE",
    locality: "Davao",
    country: "PH",
    email: "alilylipio2020@gmail.com",
    validityDays: 10950,
    errors: [],
  },
  {
    index: 1,
    filename: "arlynrendon",
    commonName: "ARLYN E. RENDON",
    p12Password: "City@Accounting2026",
    organization: "CITY ACCOUNTING OFFICE",
    locality: "Davao",
    country: "PH",
    email: "frenchtzatefer@gmail.com",
    validityDays: 10950,
    errors: [],
  },
  {
    index: 2,
    filename: "cherrymaesago",
    commonName: "CHERRY MAE P. SAGO",
    p12Password: "City@Accounting2026",
    organization: "CITY ACCOUNTING OFFICE",
    locality: "Davao",
    country: "PH",
    email: "sagocherrymae14@gmail.com",
    validityDays: 10950,
    errors: [],
  },
  {
    index: 3,
    filename: "felixrendon",
    commonName: "FELIX E. RENDON",
    p12Password: "City@Accounting2026",
    organization: "CITY ACCOUNTING OFFICE",
    locality: "Davao",
    country: "PH",
    email: "thetigergo@hotmail.com",
    validityDays: 10950,
    errors: [],
  },
];

export function downloadSampleTemplate() {
  const headers = [
    "SELF-SIGN PASSWORD",
    "FULL NAME",
    "EMAIL",
    "NAME OF OFFICE",
    "FILENAME",
  ];

  const exampleRows = [
    {
      "SELF-SIGN PASSWORD": "Password123!",
      "FULL NAME": "ALILY T. LIPIO",
      EMAIL: "alilylipio2020@gmail.com",
      "NAME OF OFFICE": "CITY ACCOUNTING OFFICE",
      FILENAME: "alilylipio",
    },
    {
      "SELF-SIGN PASSWORD": "Password123!",
      "FULL NAME": "ARLYN E. RENDON",
      EMAIL: "frenchtzatefer@gmail.com",
      "NAME OF OFFICE": "CITY ACCOUNTING OFFICE",
      FILENAME: "arlynrendon",
    },
    {
      "SELF-SIGN PASSWORD": "Password123!",
      "FULL NAME": "CHERRY MAE P. SAGO",
      EMAIL: "sagocherrymae14@gmail.com",
      "NAME OF OFFICE": "CITY ACCOUNTING OFFICE",
      FILENAME: "cherrymaesago",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleRows, { header: headers });

  ws["!cols"] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 30 },
    { wch: 28 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Certificates");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "sample_import_template.xlsx"
  );
}
